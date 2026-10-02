import { salvarDadosFinanceirosProjeto } from "@/lib/dadosProtegidos";
import { statusEfetivo } from "@/lib/statusHora";
import type { EventoCalendario, Parcela, Projeto, StatusParcela } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "80h", "80,5h", "80,25h" — horas decimais sem zeros sobrando. */
export function formatarHorasDecimais(horas: number): string {
  return `${horas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}h`;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-09" -> "set/2026". */
export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${MESES[Number(m) - 1] ?? m}/${ano}`;
}

/** Horas APROVADAS do projeto no mês (todos os recursos). Suporta horas parciais (80,5h). */
export function horasApontadasNoMes(eventos: EventoCalendario[], projetoId: string, mes: string): number {
  const total = eventos
    .filter((e) => e.projetoId === projetoId && e.data.startsWith(mes) && statusEfetivo(e) === "aprovado")
    .reduce((s, e) => s + (e.totalHoras ?? 0), 0);
  return Math.round(total * 100) / 100;
}

/** Diagnóstico: horas do projeto fora do mês/status considerados ("set/2026: 12h aprovadas", "ago/2026: 4h aguardando aprovação"). */
export function horasDoProjetoPorMesEStatus(eventos: EventoCalendario[], projetoId: string): string[] {
  const mapa = new Map<string, number>();
  for (const e of eventos) {
    if (e.projetoId !== projetoId) continue;
    const st = statusEfetivo(e);
    if (st === "cancelado" || st === "rejeitado") continue;
    const chave = `${e.data.slice(0, 7)}|${st === "aprovado" ? "aprovadas" : st === "aguardando_aprovacao" ? "aguardando aprovação" : "previstas"}`;
    mapa.set(chave, (mapa.get(chave) ?? 0) + (e.totalHoras ?? 0));
  }
  return Array.from(mapa.entries())
    .filter(([, h]) => h > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, h]) => {
      const [mes, rotulo] = k.split("|");
      return `${rotuloMes(mes)}: ${formatarHorasDecimais(Math.round(h * 100) / 100)} ${rotulo}`;
    });
}

/** Horas × valor hora, arredondado em centavos. */
export function valorDoBancoDeHoras(horas: number, valorHora: number): number {
  return Math.round(horas * valorHora * 100) / 100;
}

/** Ex.: "80h × R$ 100,00 = R$ 8.000,00". */
export function resumoBancoDeHoras(horas: number, valorHora: number): string {
  return `${formatarHorasDecimais(horas)} × ${moeda(valorHora)} = ${moeda(valorDoBancoDeHoras(horas, valorHora))}`;
}

/** A parcela (não cancelada) que já foi gerada para o mês, se houver. */
export function parcelaDoMes(projeto: Pick<Projeto, "financeiro">, mes: string): Parcela | undefined {
  return (projeto.financeiro?.parcelas ?? []).find((p) => p.periodoReferencia === mes && p.status !== "CANCELADO");
}

/**
 * Gera a parcela do banco de horas do mês, com o valor sugerido (ou o editado): entra na lista de parcelas
 * do projeto como "Aguardando" e segue o fluxo normal (liberado, faturado, recebido).
 */
export async function gerarParcelaBancoDeHoras({
  projeto,
  mes,
  horas,
  valorHora,
  valor,
}: {
  projeto: Projeto;
  mes: string;
  horas: number;
  valorHora: number;
  valor: number;
}) {
  const financeiro = projeto.financeiro;
  const parcelas = financeiro?.parcelas ?? [];
  const numero = parcelas.reduce((m, p) => Math.max(m, p.numero), 0) + 1;
  const nova: Parcela = {
    numero,
    descricao: `Banco de horas — ${rotuloMes(mes)} (${resumoBancoDeHoras(horas, valorHora)})`,
    valor,
    status: "AGUARDANDO",
    periodoReferencia: mes,
    horasApontadas: horas,
    valorHoraAplicado: valorHora,
  };
  const novas = [...parcelas, nova];
  await salvarDadosFinanceirosProjeto(projeto.id, { financeiro: { ...financeiro, numeroParcelas: novas.length, parcelas: novas } });
}

/** O que foi faturado antes de o projeto estar no sistema (ou antes de existir apontamento dele aqui). */
export interface FaturamentoAnteriorBanco {
  /** YYYY-MM das horas faturadas. */
  mes: string;
  valor: number;
  /** Opcional: horas daquele faturamento (só informação). */
  horas: number | null;
  status: Extract<StatusParcela, "LIBERADO" | "FATURADO" | "RECEBIDO">;
  /** YYYY-MM-DD em que o faturamento foi liberado/faturado — é o mês em que entra no Previsto x Realizado. */
  dataFaturamento: string;
  notaFiscal: string;
  /** YYYY-MM-DD, obrigatória quando já foi recebido. */
  dataRecebimento: string;
}

/**
 * Lança um faturamento anterior do banco de horas já na situação em que está (liberado, faturado ou recebido), com as
 * datas — como os parcelados e os marcos, que já nascem com essas datas. Entra na lista de parcelas do projeto e nos
 * relatórios pelo mês da data de faturamento.
 */
export async function lancarFaturamentoAnteriorBanco({
  projeto,
  dados,
  ator,
}: {
  projeto: Projeto;
  dados: FaturamentoAnteriorBanco;
  ator: { uid: string; nome: string };
}) {
  const financeiro = projeto.financeiro;
  const parcelas = financeiro?.parcelas ?? [];
  const numero = parcelas.reduce((m, p) => Math.max(m, p.numero), 0) + 1;
  const valorHora = financeiro?.valorHora ?? 0;
  const horas = dados.horas && dados.horas > 0 ? Math.round(dados.horas * 100) / 100 : null;
  const nova: Parcela = {
    numero,
    descricao: `Banco de horas — ${rotuloMes(dados.mes)}${horas && valorHora > 0 ? ` (${resumoBancoDeHoras(horas, valorHora)})` : ""} · faturamento anterior`,
    valor: Math.round(dados.valor * 100) / 100,
    status: dados.status,
    periodoReferencia: dados.mes,
    horasApontadas: horas,
    valorHoraAplicado: valorHora > 0 ? valorHora : null,
    // Meio-dia evita que o fuso jogue a data para o dia anterior.
    dataLiberacao: new Date(`${dados.dataFaturamento}T12:00:00`).getTime(),
    liberadoPor: ator,
    notaFiscal: dados.notaFiscal.trim() || null,
    dataRecebimento: dados.status === "RECEBIDO" ? dados.dataRecebimento : null,
  };
  const novas = [...parcelas, nova];
  await salvarDadosFinanceirosProjeto(projeto.id, {
    financeiro: JSON.parse(JSON.stringify({ ...financeiro, numeroParcelas: novas.length, parcelas: novas })),
  });
}
