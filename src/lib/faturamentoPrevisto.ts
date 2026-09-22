import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Cliente, Projeto, StatusParcela, TipoFaturamento } from "@/types";

/** Parcela/marco que já entrou de fato no caixa (contra "previsto", que ainda pode mudar). */
const STATUS_REALIZADO: StatusParcela[] = ["LIBERADO", "FATURADO", "RECEBIDO"];

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
  tipo: "liberado" | "previsto";
  tipoFaturamento: TipoFaturamento;
}

/**
 * Um item por parcela/marco do ano: "liberado" quando já foi de fato liberado nesse mês,
 * "previsto" quando ainda está Aguardando mas tem uma data prevista (parcelado) ou uma
 * previsão de faturamento (marco) caindo nesse mês.
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

      if (STATUS_REALIZADO.includes(parc.status) && parc.dataLiberacao) {
        const d = new Date(parc.dataLiberacao);
        if (d.getFullYear() === ano) {
          itens.push({ ...base, mes: `${ano}-${pad2(d.getMonth() + 1)}`, tipo: "liberado" });
        }
        continue;
      }

      if (parc.status === "AGUARDANDO") {
        const dataPrevisao = tipoFaturamento === "marco_faturamento" ? parc.dataPrevisaoFaturamento : parc.dataPrevista;
        if (dataPrevisao?.startsWith(`${ano}-`)) {
          itens.push({ ...base, mes: dataPrevisao.slice(0, 7), tipo: "previsto" });
        }
      }
    }
  }
  return itens;
}

export interface FiltrosFaturamento {
  clienteId: string;
  tipoFaturamento: "" | TipoFaturamento;
}

export function filtrarItens(itens: ItemFaturamento[], filtros: FiltrosFaturamento): ItemFaturamento[] {
  return itens.filter(
    (it) =>
      (!filtros.clienteId || it.clienteId === filtros.clienteId) &&
      (!filtros.tipoFaturamento || it.tipoFaturamento === filtros.tipoFaturamento)
  );
}

export interface TotalMes {
  mes: string;
  label: string;
  liberado: number;
  previsto: number;
}

/** Um total por mês do ano inteiro (mesmo os meses sem nada, para o gráfico não "pular"). */
export function totaisPorMes(itens: ItemFaturamento[], ano: number): TotalMes[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = `${ano}-${pad2(i + 1)}`;
    const doMes = itens.filter((it) => it.mes === mes);
    return {
      mes,
      label: MESES_ABREV[i],
      liberado: doMes.filter((it) => it.tipo === "liberado").reduce((s, it) => s + it.valor, 0),
      previsto: doMes.filter((it) => it.tipo === "previsto").reduce((s, it) => s + it.valor, 0),
    };
  });
}

export const totalDoAno = (totais: TotalMes[]) => totais.reduce((s, t) => s + t.liberado + t.previsto, 0);

export interface LinhaClienteMes {
  clienteId: string;
  cliente: string;
  /** Valor total contratado dos projetos do cliente que têm algo nesse mês. */
  valorVenda: number;
  /** Já faturado (qualquer mês) nesses mesmos projetos. */
  faturado: number;
  saldo: number;
  totalMes: number;
  itens: ItemFaturamento[];
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
      const faturado = projetosDoCliente.reduce(
        (s, p) =>
          s +
          (p.financeiro?.parcelas ?? [])
            .filter((pc) => STATUS_REALIZADO.includes(pc.status))
            .reduce((s2, pc) => s2 + pc.valor, 0),
        0
      );
      return {
        clienteId,
        cliente: itensCliente[0].cliente,
        valorVenda,
        faturado,
        saldo: valorVenda - faturado,
        totalMes: itensCliente.reduce((s, i) => s + i.valor, 0),
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
  /** Já faturado (qualquer mês) nesses mesmos projetos. */
  faturado: number;
  saldo: number;
  /** Um valor por mês, Jan a Dez (liberado + previsto, o que está "programado" para faturar naquele mês). */
  previstoPorMes: number[];
  totalPrevistoAno: number;
}

/**
 * A estrutura pedida para o relatório: Cliente | Valor Venda | Faturado | Saldo | Previsto
 * Jan..Dez | Total. `itens` já vem filtrado ao ano desejado por `montarItensFaturamento`.
 */
export function matrizAnual(itens: ItemFaturamento[], projetos: Projeto[]): LinhaMatrizAnual[] {
  const porCliente = new Map<string, ItemFaturamento[]>();
  itens.forEach((it) => porCliente.set(it.clienteId, [...(porCliente.get(it.clienteId) ?? []), it]));

  return [...porCliente.entries()]
    .map(([clienteId, itensCliente]) => {
      const idsProjetos = new Set(itensCliente.map((i) => i.projetoId));
      const projetosDoCliente = projetos.filter((p) => idsProjetos.has(p.id));
      const valorVenda = projetosDoCliente.reduce((s, p) => s + (p.financeiro?.valorTotal ?? 0), 0);
      const faturado = projetosDoCliente.reduce(
        (s, p) =>
          s +
          (p.financeiro?.parcelas ?? [])
            .filter((pc) => STATUS_REALIZADO.includes(pc.status))
            .reduce((s2, pc) => s2 + pc.valor, 0),
        0
      );
      const previstoPorMes = Array(12).fill(0) as number[];
      itensCliente.forEach((it) => {
        previstoPorMes[Number(it.mes.slice(5, 7)) - 1] += it.valor;
      });
      return {
        clienteId,
        cliente: itensCliente[0].cliente,
        valorVenda,
        faturado,
        saldo: valorVenda - faturado,
        previstoPorMes,
        totalPrevistoAno: previstoPorMes.reduce((s, v) => s + v, 0),
      };
    })
    .sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR"));
}

function cabecalhoMatriz(ano: number): string[] {
  return ["Cliente", "Valor Venda", "Faturado", "Saldo", ...MESES_ABREV.map((m) => `Previsto ${m}`), `Total Previsto ${ano}`];
}

function linhaMatrizParaCelulas(l: LinhaMatrizAnual): string[] {
  return [
    l.cliente,
    moeda(l.valorVenda),
    moeda(l.faturado),
    moeda(l.saldo),
    ...l.previstoPorMes.map((v) => moeda(v)),
    moeda(l.totalPrevistoAno),
  ];
}

function linhaTotalMatriz(linhas: LinhaMatrizAnual[]): string[] {
  const totalPorMes = Array(12).fill(0) as number[];
  linhas.forEach((l) => l.previstoPorMes.forEach((v, i) => (totalPorMes[i] += v)));
  return [
    "Total",
    moeda(linhas.reduce((s, l) => s + l.valorVenda, 0)),
    moeda(linhas.reduce((s, l) => s + l.faturado, 0)),
    moeda(linhas.reduce((s, l) => s + l.saldo, 0)),
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
  // Paisagem: Cliente + 3 colunas + 12 meses + total são 16 colunas.
  const pdf = new jsPDF({ orientation: "landscape" });
  pdf.setFontSize(14);
  pdf.text(`Faturamento previsto — ${ano}`, 14, 14);
  autoTable(pdf, {
    startY: 20,
    head: [cabecalhoMatriz(ano)],
    body: linhas.map(linhaMatrizParaCelulas),
    foot: [linhaTotalMatriz(linhas)],
    styles: { fontSize: 6.5, cellPadding: 1.5 },
    footStyles: { fontStyle: "bold", fillColor: [238, 241, 248], textColor: [21, 40, 73] },
    margin: { left: 8, right: 8 },
  });
  pdf.save(`faturamento-previsto-${ano}.pdf`);
}
