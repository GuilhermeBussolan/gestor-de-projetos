import jsPDF from "jspdf";
import { linhaCsv } from "@/lib/csv";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Cliente, Parcela, Projeto, StatusParcela, TipoFaturamento } from "@/types";

/** Parcela/marco que já entrou de fato no caixa (contra "previsto", que ainda pode mudar). */
const STATUS_REALIZADO: StatusParcela[] = ["LIBERADO", "FATURADO", "RECEBIDO"];

/** Situação de cada lançamento do mês: o previsto (ainda aguardando) e cada status da parcela. */
export type TipoItemFaturamento = "previsto" | "liberado" | "faturado" | "recebido" | "cancelado";

export const TIPOS_ITEM_ORDEM: TipoItemFaturamento[] = ["previsto", "liberado", "faturado", "recebido", "cancelado"];

export const TIPO_ITEM_CONFIG: Record<TipoItemFaturamento, { label: string; cor: string; bg: string; text: string }> = {
  // Previsto em cinza claro; Liberado #00B0F0 e Recebido #00B050 (cores definidas pelo usuário); Faturado em azul escuro.
  previsto: { label: "Previsto", cor: "#D9D9D9", bg: "#f1f1f1", text: "#6b6b6b" },
  liberado: { label: "Liberado", cor: "#00B0F0", bg: "#e0f6fe", text: "#0079a8" },
  faturado: { label: "Faturado", cor: "#1f4fae", bg: "#dfe8fb", text: "#1c4a9e" },
  recebido: { label: "Recebido", cor: "#00B050", bg: "#e0f7ea", text: "#007a38" },
  cancelado: { label: "Cancelado", cor: "#b5392a", bg: "#fdeceb", text: "#b5392a" },
};

const TIPO_POR_STATUS: Partial<Record<StatusParcela, TipoItemFaturamento>> = {
  LIBERADO: "liberado",
  FATURADO: "faturado",
  RECEBIDO: "recebido",
};

/** O que está "programado" para faturar no mês: tudo, menos o que foi cancelado. */
const TIPOS_PROGRAMADOS: TipoItemFaturamento[] = ["previsto", "liberado", "faturado", "recebido"];

const MESES_ABREV = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Filtro de ano da tela: um ano específico ou "todos" (o período inteiro que tem dados). */
export type AnoFiltro = number | "todos";

/** "2026-10" -> "Out/2026". */
export const rotuloMesAno = (mes: string) => `${MESES_ABREV[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`;
/** "2026-10" -> "Out". */
export const rotuloMes = (mes: string) => MESES_ABREV[Number(mes.slice(5, 7)) - 1];
/** " 2026" num ano; vazio em "todos" (as colunas valem para o período inteiro). */
export const sufixoAno = (ano: AnoFiltro) => (ano === "todos" ? "" : ` ${ano}`);

/** Todos os meses (YYYY-MM) de `inicio` a `fim`, inclusive. */
function mesesEntre(inicio: string, fim: string): string[] {
  const meses: string[] = [];
  let [ano, mes] = inicio.split("-").map(Number);
  const [anoFim, mesFim] = fim.split("-").map(Number);
  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    meses.push(`${ano}-${pad2(mes)}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return meses;
}

/**
 * Os meses da tabela: do primeiro ao último mês que têm algum lançamento (os vazios do meio aparecem, para a linha
 * do tempo não pular). Vale tanto para um ano quanto para "todos".
 */
export function mesesComDados(itens: ItemFaturamento[]): string[] {
  if (itens.length === 0) return [];
  const ordenados = itens.map((i) => i.mes).sort();
  return mesesEntre(ordenados[0], ordenados[ordenados.length - 1]);
}

/** Anos do filtro: do primeiro ao último ano com lançamento (sem pular nenhum), sempre incluindo o ano atual. */
export function anosComDados(itens: ItemFaturamento[], anoAtual: number): number[] {
  const anos = [anoAtual, ...itens.map((i) => Number(i.mes.slice(0, 4)))];
  const de = Math.min(...anos);
  const ate = Math.max(...anos);
  return Array.from({ length: ate - de + 1 }, (_, i) => de + i);
}

export interface ItemFaturamento {
  projetoId: string;
  clienteId: string;
  cliente: string;
  codigoProposta: string;
  /** "Parcela 3" ou a descrição do marco (ex.: "MIT041 — Diagrama de processos"). */
  identificacao: string;
  valor: number;
  /** YYYY-MM. */
  mes: string;
  tipo: TipoItemFaturamento;
  tipoFaturamento: TipoFaturamento;
}

/** Mês (YYYY-MM) com um ano plausível. Datas digitadas errado (ex.: ano "0022") ficam de fora do relatório. */
const mesValido = (mes: string) => /^20\d\d-(0[1-9]|1[0-2])$/.test(mes);

/** Parcela que ficou fora do relatório: data inválida (ano estranho) ou sem nenhuma data para posicioná-la num mês. */
export interface LancamentoDataInvalida {
  projetoId: string;
  cliente: string;
  codigoProposta: string;
  identificacao: string;
  valor: number;
  /** data_invalida: ano estranho; sem_liberacao: já liberada, mas sem a data da liberação; sem_previsao: aguardando, sem previsão. */
  motivo: "data_invalida" | "sem_liberacao" | "sem_previsao";
  /** A data como está gravada (para a pessoa achar e corrigir); vazio quando não há data. */
  data: string;
}

/** Projetos antigos não têm `tipoFaturamento`: valem como parcelado (o mesmo que o resto do sistema assume). */
const tipoDoProjeto = (projeto: Projeto): TipoFaturamento => projeto.financeiro?.tipoFaturamento ?? "parcelado";

const isoParaMes = (iso: string | null | undefined) => (iso ? { mes: iso.slice(0, 7), data: iso.split("-").reverse().join("/") } : null);

/** Mês seguinte ("2026-09" -> "2026-10"). */
function mesSeguinte(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return m === 12 ? `${ano + 1}-01` : `${ano}-${pad2(m + 1)}`;
}

/**
 * Previsão de liberação de uma parcela ainda aguardando: a data prevista (parcelado) ou a previsão de faturamento
 * (marco) — se a principal faltar, a outra. O banco de horas não tem previsão gravada: as horas de um mês são
 * liberadas no mês seguinte, então vale o mês seguinte ao de referência.
 */
function previsaoDeLiberacao(parc: Parcela, tipoFaturamento: TipoFaturamento): { mes: string; data: string } | null {
  const principal = tipoFaturamento === "marco_faturamento" ? parc.dataPrevisaoFaturamento : parc.dataPrevista;
  const alternativa = tipoFaturamento === "marco_faturamento" ? parc.dataPrevista : parc.dataPrevisaoFaturamento;
  const previsao = isoParaMes(principal) ?? isoParaMes(alternativa);
  if (previsao) return previsao;
  if (parc.periodoReferencia) {
    const mes = mesSeguinte(parc.periodoReferencia.slice(0, 7));
    return { mes, data: rotuloMesAno(mes) };
  }
  return null;
}

/**
 * Em que mês a parcela entra no relatório e em que situação, sempre pela LIBERAÇÃO do faturamento:
 *  - liberado/faturado/recebido: o mês em que foi liberada (data de liberação). Sem essa data, fica de fora e é avisada;
 *  - aguardando ("previsto"): o mês em que está prevista a liberação (`previsaoDeLiberacao`);
 *  - cancelado: o mês do cancelamento (ou, sem ele, o da previsão de liberação).
 */
function posicaoDaParcela(
  parc: Parcela,
  tipoFaturamento: TipoFaturamento
): { mes: string; data: string; tipo: TipoItemFaturamento } | null {
  const tipoRealizado = TIPO_POR_STATUS[parc.status];
  if (tipoRealizado) {
    if (!parc.dataLiberacao) return null;
    const d = new Date(parc.dataLiberacao);
    return { mes: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`, data: d.toLocaleDateString("pt-BR"), tipo: tipoRealizado };
  }
  if (parc.status === "CANCELADO") {
    const ref = isoParaMes(parc.dataCancelamento) ?? previsaoDeLiberacao(parc, tipoFaturamento);
    return ref ? { ...ref, tipo: "cancelado" } : null;
  }
  const previsao = previsaoDeLiberacao(parc, tipoFaturamento);
  return previsao ? { ...previsao, tipo: "previsto" } : null;
}

/**
 * Parcelas que ficaram de fora do relatório, para a tela avisar: data inválida (ano antes de 2000 ou depois de 2099)
 * ou nenhuma data para posicioná-las num mês.
 */
export function lancamentosComDataInvalida(projetos: Projeto[], clientes: Cliente[]): LancamentoDataInvalida[] {
  const lista: LancamentoDataInvalida[] = [];
  for (const projeto of projetos) {
    const tipoFaturamento = tipoDoProjeto(projeto);
    for (const parc of projeto.financeiro?.parcelas ?? []) {
      const pos = posicaoDaParcela(parc, tipoFaturamento);
      if (pos && mesValido(pos.mes)) continue;
      lista.push({
        projetoId: projeto.id,
        cliente: nomeExibicaoCliente(clientes.find((c) => c.id === projeto.clienteId)),
        codigoProposta: projeto.codigoProposta,
        identificacao: parc.descricao ? parc.descricao : `Parcela ${parc.numero}`,
        valor: parc.valor,
        motivo: pos ? "data_invalida" : TIPO_POR_STATUS[parc.status] ? "sem_liberacao" : "sem_previsao",
        data: pos?.data ?? "",
      });
    }
  }
  return lista;
}

/**
 * Um item por parcela/marco do período, no mês e na situação que `posicaoDaParcela` define. Entram todos os tipos de
 * faturamento que têm parcelas (parcelado, marco e banco de horas); "apontamento de horas" não gera parcelas.
 */
export function montarItensFaturamento(projetos: Projeto[], clientes: Cliente[], ano: AnoFiltro): ItemFaturamento[] {
  const itens: ItemFaturamento[] = [];
  const noPeriodo = (mes: string) => mesValido(mes) && (ano === "todos" || mes.startsWith(`${ano}-`));
  for (const projeto of projetos) {
    const tipoFaturamento = tipoDoProjeto(projeto);
    const cliente = nomeExibicaoCliente(clientes.find((c) => c.id === projeto.clienteId));

    for (const parc of projeto.financeiro?.parcelas ?? []) {
      const pos = posicaoDaParcela(parc, tipoFaturamento);
      if (!pos || !noPeriodo(pos.mes)) continue;
      itens.push({
        projetoId: projeto.id,
        clienteId: projeto.clienteId,
        cliente,
        codigoProposta: projeto.codigoProposta,
        identificacao: parc.descricao ? parc.descricao : `Parcela ${parc.numero}`,
        valor: parc.valor,
        tipoFaturamento,
        mes: pos.mes,
        tipo: pos.tipo,
      });
    }
  }
  return itens;
}

export interface FiltrosFaturamento {
  clienteId: string;
  tipoFaturamento: "" | TipoFaturamento;
  status: "" | TipoItemFaturamento;
}

export function filtrarItens(itens: ItemFaturamento[], filtros: FiltrosFaturamento): ItemFaturamento[] {
  return itens.filter(
    (it) =>
      (!filtros.clienteId || it.clienteId === filtros.clienteId) &&
      (!filtros.tipoFaturamento || it.tipoFaturamento === filtros.tipoFaturamento) &&
      (!filtros.status || it.tipo === filtros.status)
  );
}

export type TotalMes = { mes: string; label: string } & Record<TipoItemFaturamento, number>;

const somaDoTipo = (itens: ItemFaturamento[], tipo: TipoItemFaturamento) =>
  itens.filter((it) => it.tipo === tipo).reduce((s, it) => s + it.valor, 0);

/**
 * Um total por mês para o gráfico: num ano, os 12 meses (mesmo os vazios, para não "pular"); em "todos", do primeiro
 * ao último mês com dados.
 */
export function totaisPorMes(itens: ItemFaturamento[], ano: AnoFiltro): TotalMes[] {
  const meses = ano === "todos" ? mesesComDados(itens) : Array.from({ length: 12 }, (_, i) => `${ano}-${pad2(i + 1)}`);
  return meses.map((mes) => {
    const doMes = itens.filter((it) => it.mes === mes);
    return {
      mes,
      label: rotuloMes(mes),
      previsto: somaDoTipo(doMes, "previsto"),
      liberado: somaDoTipo(doMes, "liberado"),
      faturado: somaDoTipo(doMes, "faturado"),
      recebido: somaDoTipo(doMes, "recebido"),
      cancelado: somaDoTipo(doMes, "cancelado"),
    };
  });
}

/** Tudo que está programado para faturar no mês (previsto + liberado + faturado + recebido), sem o cancelado. */
export const totalProgramadoDoMes = (t: Pick<TotalMes, TipoItemFaturamento>) =>
  TIPOS_PROGRAMADOS.reduce((s, tipo) => s + t[tipo], 0);

export const totalDoAno = (totais: TotalMes[]) => totais.reduce((s, t) => s + totalProgramadoDoMes(t), 0);

/** Total do ano por situação — a legenda do gráfico. */
export function totaisDoAnoPorTipo(totais: TotalMes[]): Record<TipoItemFaturamento, number> {
  const soma = { previsto: 0, liberado: 0, faturado: 0, recebido: 0, cancelado: 0 };
  totais.forEach((t) => TIPOS_ITEM_ORDEM.forEach((tipo) => (soma[tipo] += t[tipo])));
  return soma;
}

export interface LinhaClienteMes {
  clienteId: string;
  cliente: string;
  /** Valor total contratado dos projetos do cliente que têm algo nesse mês. */
  valorVenda: number;
  /** Já realizado (liberado, faturado ou recebido, em qualquer mês) nesses mesmos projetos. */
  realizado: number;
  saldo: number;
  /** Programado no mês (sem o que foi cancelado). */
  totalMes: number;
  /** Cancelado no mês — fora do total, só para referência. */
  canceladoMes: number;
  itens: ItemFaturamento[];
}

function valorRealizadoDosProjetos(projetosDoCliente: Projeto[]): number {
  return projetosDoCliente.reduce(
    (s, p) =>
      s +
      (p.financeiro?.parcelas ?? [])
        .filter((pc) => STATUS_REALIZADO.includes(pc.status))
        .reduce((s2, pc) => s2 + pc.valor, 0),
    0
  );
}

/** Detalhe de um mês, agregado por cliente — o que abre ao clicar numa barra do gráfico. */
export function detalheDoMes(
  itens: ItemFaturamento[],
  projetos: Projeto[],
  mes: string
): LinhaClienteMes[] {
  const doMes = itens.filter((it) => it.mes === mes);
  const porCliente = new Map<string, ItemFaturamento[]>();
  doMes.forEach((it) => porCliente.set(it.clienteId, [...(porCliente.get(it.clienteId) ?? []), it]));

  return [...porCliente.entries()]
    .map(([clienteId, itensCliente]) => {
      const idsProjetos = new Set(itensCliente.map((i) => i.projetoId));
      const projetosDoCliente = projetos.filter((p) => idsProjetos.has(p.id));
      const valorVenda = projetosDoCliente.reduce((s, p) => s + (p.financeiro?.valorTotal ?? 0), 0);
      const realizado = valorRealizadoDosProjetos(projetosDoCliente);
      return {
        clienteId,
        cliente: itensCliente[0].cliente,
        valorVenda,
        realizado,
        saldo: valorVenda - realizado,
        totalMes: itensCliente.filter((i) => i.tipo !== "cancelado").reduce((s, i) => s + i.valor, 0),
        canceladoMes: somaDoTipo(itensCliente, "cancelado"),
        itens: itensCliente.sort((a, b) => a.codigoProposta.localeCompare(b.codigoProposta)),
      };
    })
    .sort((a, b) => b.totalMes - a.totalMes);
}

export interface LinhaMatrizAnual {
  clienteId: string;
  cliente: string;
  /** Valor total contratado dos projetos do cliente que têm algo no ano (com os filtros atuais). */
  valorVenda: number;
  /** Já realizado (liberado, faturado ou recebido, em qualquer mês) nesses mesmos projetos. */
  realizado: number;
  saldo: number;
  /** Total do ano por situação (liberado, faturado, recebido, cancelado, previsto). */
  porTipo: Record<TipoItemFaturamento, number>;
  /** Um valor por mês de `meses` (o que está "programado" para faturar naquele mês, sem o cancelado). */
  previstoPorMes: number[];
  totalPrevisto: number;
}

/**
 * A estrutura pedida para o relatório: Cliente | Valor Venda | Realizado | Saldo | Liberado |
 * Faturado | Recebido | Cancelado | Previsto de cada mês de `meses` | Total. `itens` já vem filtrado
 * ao período desejado por `montarItensFaturamento`.
 */
export function matrizAnual(itens: ItemFaturamento[], projetos: Projeto[], meses: string[]): LinhaMatrizAnual[] {
  const posicao = new Map(meses.map((m, i) => [m, i]));
  const porCliente = new Map<string, ItemFaturamento[]>();
  itens.forEach((it) => porCliente.set(it.clienteId, [...(porCliente.get(it.clienteId) ?? []), it]));

  return [...porCliente.entries()]
    .map(([clienteId, itensCliente]) => {
      const idsProjetos = new Set(itensCliente.map((i) => i.projetoId));
      const projetosDoCliente = projetos.filter((p) => idsProjetos.has(p.id));
      const valorVenda = projetosDoCliente.reduce((s, p) => s + (p.financeiro?.valorTotal ?? 0), 0);
      const realizado = valorRealizadoDosProjetos(projetosDoCliente);
      const previstoPorMes = Array(meses.length).fill(0) as number[];
      itensCliente
        .filter((it) => it.tipo !== "cancelado")
        .forEach((it) => {
          const i = posicao.get(it.mes);
          if (i !== undefined) previstoPorMes[i] += it.valor;
        });
      return {
        clienteId,
        cliente: itensCliente[0].cliente,
        valorVenda,
        realizado,
        saldo: valorVenda - realizado,
        porTipo: {
          previsto: somaDoTipo(itensCliente, "previsto"),
          liberado: somaDoTipo(itensCliente, "liberado"),
          faturado: somaDoTipo(itensCliente, "faturado"),
          recebido: somaDoTipo(itensCliente, "recebido"),
          cancelado: somaDoTipo(itensCliente, "cancelado"),
        },
        previstoPorMes,
        totalPrevisto: previstoPorMes.reduce((s, v) => s + v, 0),
      };
    })
    .sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR"));
}

function cabecalhoMatriz(ano: AnoFiltro, meses: string[]): string[] {
  const sufixo = sufixoAno(ano);
  return [
    "Cliente",
    "Valor Venda",
    "Realizado",
    "Saldo",
    `Liberado${sufixo}`,
    `Faturado${sufixo}`,
    `Recebido${sufixo}`,
    `Cancelado${sufixo}`,
    ...meses.map((m) => `Previsto ${rotuloMesAno(m)}`),
    `Total Previsto${sufixo}`,
  ];
}

function linhaMatrizParaCelulas(l: LinhaMatrizAnual): string[] {
  return [
    l.cliente,
    moeda(l.valorVenda),
    moeda(l.realizado),
    moeda(l.saldo),
    moeda(l.porTipo.liberado),
    moeda(l.porTipo.faturado),
    moeda(l.porTipo.recebido),
    moeda(l.porTipo.cancelado),
    ...l.previstoPorMes.map((v) => moeda(v)),
    moeda(l.totalPrevisto),
  ];
}

/** Totais da matriz (por situação e por mês): a linha "Total" da tela e das exportações. */
export function totaisDaMatriz(linhas: LinhaMatrizAnual[], quantidadeMeses: number) {
  const porMes = Array(quantidadeMeses).fill(0) as number[];
  linhas.forEach((l) => l.previstoPorMes.forEach((v, i) => (porMes[i] += v)));
  const soma = (fn: (l: LinhaMatrizAnual) => number) => linhas.reduce((s, l) => s + fn(l), 0);
  return {
    valorVenda: soma((l) => l.valorVenda),
    realizado: soma((l) => l.realizado),
    saldo: soma((l) => l.saldo),
    porTipo: Object.fromEntries(TIPOS_ITEM_ORDEM.map((t) => [t, soma((l) => l.porTipo[t])])) as Record<TipoItemFaturamento, number>,
    porMes,
    totalPrevisto: soma((l) => l.totalPrevisto),
  };
}

function linhaTotalMatriz(linhas: LinhaMatrizAnual[], quantidadeMeses: number): string[] {
  const t = totaisDaMatriz(linhas, quantidadeMeses);
  return [
    "Total",
    moeda(t.valorVenda),
    moeda(t.realizado),
    moeda(t.saldo),
    moeda(t.porTipo.liberado),
    moeda(t.porTipo.faturado),
    moeda(t.porTipo.recebido),
    moeda(t.porTipo.cancelado),
    ...t.porMes.map((v) => moeda(v)),
    moeda(t.totalPrevisto),
  ];
}

/** "2026" ou, em "todos", o período coberto ("2025-2028"). */
function rotuloArquivo(ano: AnoFiltro, meses: string[]): string {
  if (ano !== "todos") return String(ano);
  if (meses.length === 0) return "todos";
  const de = meses[0].slice(0, 4);
  const ate = meses[meses.length - 1].slice(0, 4);
  return de === ate ? de : `${de}-${ate}`;
}

export function exportarMatrizCsv(linhas: LinhaMatrizAnual[], ano: AnoFiltro, meses: string[]) {
  const corpo = [...linhas.map(linhaMatrizParaCelulas), linhaTotalMatriz(linhas, meses.length)].map((c) =>
    linhaCsv(c)
  );
  const csv = [linhaCsv(cabecalhoMatriz(ano, meses)), ...corpo].join("\r\n");
  saveAs(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `faturamento-previsto-${rotuloArquivo(ano, meses)}.csv`);
}

export function exportarMatrizPdf(linhas: LinhaMatrizAnual[], ano: AnoFiltro, meses: string[]) {
  // Paisagem; com muitos meses (período de vários anos) usa A3 e letra menor para caber.
  const muitasColunas = meses.length > 12;
  const pdf = new jsPDF({ orientation: "landscape", format: muitasColunas ? "a3" : "a4" });
  const rotulo = rotuloArquivo(ano, meses);
  pdf.setFontSize(14);
  pdf.text(
    `Faturamento previsto x realizado — ${meses.length > 0 ? `${rotuloMesAno(meses[0])} a ${rotuloMesAno(meses[meses.length - 1])}` : rotulo}`,
    14,
    14
  );
  autoTable(pdf, {
    startY: 20,
    head: [cabecalhoMatriz(ano, meses)],
    body: linhas.map(linhaMatrizParaCelulas),
    foot: [linhaTotalMatriz(linhas, meses.length)],
    styles: { fontSize: meses.length > 24 ? 4.2 : 5.5, cellPadding: 1 },
    footStyles: { fontStyle: "bold", fillColor: [238, 241, 248], textColor: [21, 40, 73] },
    margin: { left: 6, right: 6 },
  });
  pdf.save(`faturamento-previsto-${rotulo}.pdf`);
}
