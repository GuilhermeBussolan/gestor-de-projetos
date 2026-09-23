import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Cliente, Projeto, StatusParcela, TipoFaturamento } from "@/types";

/** Parcela/marco que já entrou de fato no caixa (contra "previsto", que ainda pode mudar). */
const STATUS_REALIZADO: StatusParcela[] = ["LIBERADO", "FATURADO", "RECEBIDO"];

/** Situação de cada lançamento do mês: o previsto (ainda aguardando) e cada status da parcela. */
export type TipoItemFaturamento = "previsto" | "liberado" | "faturado" | "recebido" | "cancelado";

export const TIPOS_ITEM_ORDEM: TipoItemFaturamento[] = ["previsto", "liberado", "faturado", "recebido", "cancelado"];

export const TIPO_ITEM_CONFIG: Record<TipoItemFaturamento, { label: string; cor: string; bg: string; text: string }> = {
  previsto: { label: "Previsto", cor: "#2f6fe4", bg: "#e8efff", text: "#2456b8" },
  liberado: { label: "Liberado", cor: "#15754c", bg: "#e3f5ea", text: "#15754c" },
  faturado: { label: "Faturado", cor: "#e08a1e", bg: "#fff2de", text: "#a4650d" },
  recebido: { label: "Recebido", cor: "#0f9ed5", bg: "#e0f4fb", text: "#0b6f96" },
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

/**
 * Um item por parcela/marco do ano, na situação em que ela está: "liberado", "faturado" e "recebido"
 * no mês em que foi liberada; "cancelado" no mês do cancelamento (ou, sem essa data, da previsão);
 * "previsto" quando ainda está Aguardando mas tem uma data prevista (parcelado) ou uma previsão de
 * faturamento (marco) caindo nesse mês.
 */
export function montarItensFaturamento(projetos: Projeto[], clientes: Cliente[], ano: number): ItemFaturamento[] {
  const itens: ItemFaturamento[] = [];
  for (const projeto of projetos) {
    const tipoFaturamento = projeto.financeiro?.tipoFaturamento;
    if (!tipoFaturamento || tipoFaturamento === "apontamento_horas") continue;
    const cliente = nomeExibicaoCliente(clientes.find((c) => c.id === projeto.clienteId));

    for (const parc of projeto.financeiro.parcelas) {
      const identificacao = parc.descricao ? parc.descricao : `Parcela ${parc.numero}`;
      const base = {
        projetoId: projeto.id,
        clienteId: projeto.clienteId,
        cliente,
        codigoProposta: projeto.codigoProposta,
        identificacao,
        valor: parc.valor,
        tipoFaturamento,
      };
      const dataPrevisao = tipoFaturamento === "marco_faturamento" ? parc.dataPrevisaoFaturamento : parc.dataPrevista;

      const tipoRealizado = TIPO_POR_STATUS[parc.status];
      if (tipoRealizado && parc.dataLiberacao) {
        const d = new Date(parc.dataLiberacao);
        if (d.getFullYear() === ano) {
          itens.push({ ...base, mes: `${ano}-${pad2(d.getMonth() + 1)}`, tipo: tipoRealizado });
        }
        continue;
      }

      if (parc.status === "CANCELADO") {
        const dataRef = parc.dataCancelamento || dataPrevisao;
        if (dataRef?.startsWith(`${ano}-`)) {
          itens.push({ ...base, mes: dataRef.slice(0, 7), tipo: "cancelado" });
        }
        continue;
      }

      if (parc.status === "AGUARDANDO" && dataPrevisao?.startsWith(`${ano}-`)) {
        itens.push({ ...base, mes: dataPrevisao.slice(0, 7), tipo: "previsto" });
      }
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

/** Um total por mês do ano inteiro (mesmo os meses sem nada, para o gráfico não "pular"). */
export function totaisPorMes(itens: ItemFaturamento[], ano: number): TotalMes[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = `${ano}-${pad2(i + 1)}`;
    const doMes = itens.filter((it) => it.mes === mes);
    return {
      mes,
      label: MESES_ABREV[i],
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
  /** Um valor por mês, Jan a Dez (o que está "programado" para faturar naquele mês, sem o cancelado). */
  previstoPorMes: number[];
  totalPrevistoAno: number;
}

/**
 * A estrutura pedida para o relatório: Cliente | Valor Venda | Realizado | Saldo | Liberado |
 * Faturado | Recebido | Cancelado | Previsto Jan..Dez | Total. `itens` já vem filtrado ao ano
 * desejado por `montarItensFaturamento`.
 */
export function matrizAnual(itens: ItemFaturamento[], projetos: Projeto[]): LinhaMatrizAnual[] {
  const porCliente = new Map<string, ItemFaturamento[]>();
  itens.forEach((it) => porCliente.set(it.clienteId, [...(porCliente.get(it.clienteId) ?? []), it]));

  return [...porCliente.entries()]
    .map(([clienteId, itensCliente]) => {
      const idsProjetos = new Set(itensCliente.map((i) => i.projetoId));
      const projetosDoCliente = projetos.filter((p) => idsProjetos.has(p.id));
      const valorVenda = projetosDoCliente.reduce((s, p) => s + (p.financeiro?.valorTotal ?? 0), 0);
      const realizado = valorRealizadoDosProjetos(projetosDoCliente);
      const previstoPorMes = Array(12).fill(0) as number[];
      itensCliente
        .filter((it) => it.tipo !== "cancelado")
        .forEach((it) => {
          previstoPorMes[Number(it.mes.slice(5, 7)) - 1] += it.valor;
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
        totalPrevistoAno: previstoPorMes.reduce((s, v) => s + v, 0),
      };
    })
    .sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR"));
}

function cabecalhoMatriz(ano: number): string[] {
  return [
    "Cliente",
    "Valor Venda",
    "Realizado",
    "Saldo",
    `Liberado ${ano}`,
    `Faturado ${ano}`,
    `Recebido ${ano}`,
    `Cancelado ${ano}`,
    ...MESES_ABREV.map((m) => `Previsto ${m}`),
    `Total Previsto ${ano}`,
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
    moeda(l.totalPrevistoAno),
  ];
}

function linhaTotalMatriz(linhas: LinhaMatrizAnual[]): string[] {
  const totalPorMes = Array(12).fill(0) as number[];
  linhas.forEach((l) => l.previstoPorMes.forEach((v, i) => (totalPorMes[i] += v)));
  const somaTipo = (tipo: TipoItemFaturamento) => linhas.reduce((s, l) => s + l.porTipo[tipo], 0);
  return [
    "Total",
    moeda(linhas.reduce((s, l) => s + l.valorVenda, 0)),
    moeda(linhas.reduce((s, l) => s + l.realizado, 0)),
    moeda(linhas.reduce((s, l) => s + l.saldo, 0)),
    moeda(somaTipo("liberado")),
    moeda(somaTipo("faturado")),
    moeda(somaTipo("recebido")),
    moeda(somaTipo("cancelado")),
    ...totalPorMes.map((v) => moeda(v)),
    moeda(linhas.reduce((s, l) => s + l.totalPrevistoAno, 0)),
  ];
}

export function exportarMatrizCsv(linhas: LinhaMatrizAnual[], ano: number) {
  const corpo = [...linhas.map(linhaMatrizParaCelulas), linhaTotalMatriz(linhas)].map((c) =>
    c.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")
  );
  const csv = [cabecalhoMatriz(ano).join(";"), ...corpo].join("\r\n");
  saveAs(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `faturamento-previsto-${ano}.csv`);
}

export function exportarMatrizPdf(linhas: LinhaMatrizAnual[], ano: number) {
  // Paisagem: Cliente + 7 colunas + 12 meses + total são 20 colunas.
  const pdf = new jsPDF({ orientation: "landscape" });
  pdf.setFontSize(14);
  pdf.text(`Faturamento previsto x realizado — ${ano}`, 14, 14);
  autoTable(pdf, {
    startY: 20,
    head: [cabecalhoMatriz(ano)],
    body: linhas.map(linhaMatrizParaCelulas),
    foot: [linhaTotalMatriz(linhas)],
    styles: { fontSize: 5.5, cellPadding: 1.2 },
    footStyles: { fontStyle: "bold", fillColor: [238, 241, 248], textColor: [21, 40, 73] },
    margin: { left: 6, right: 6 },
  });
  pdf.save(`faturamento-previsto-${ano}.pdf`);
}
