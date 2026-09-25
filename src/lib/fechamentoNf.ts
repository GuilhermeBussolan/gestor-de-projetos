import { calcularVencimentoFechamento } from "@/lib/feriados";
import type { ConfirmacaoFechamento, FechamentoParceiro } from "@/types";

/** Onde cada parceira está no caminho: confirmação -> NF -> pagamento -> encerrado. */
export type SituacaoParceiro =
  | "aguardando_ciencia"
  | "aguardando_confirmacao"
  | "contestado"
  | "aguardando_nf"
  | "nf_enviada"
  | "nf_rejeitada"
  | "aguardando_pagamento"
  | "pago_parcial"
  | "encerrado";

export const SITUACAO_PARCEIRO_CONFIG: Record<SituacaoParceiro, { label: string; bg: string; text: string }> = {
  aguardando_ciencia: { label: "Aguardando ciência", bg: "#fff2de", text: "#a4650d" },
  aguardando_confirmacao: { label: "Consultores a confirmar", bg: "#fff2de", text: "#a4650d" },
  contestado: { label: "Contestado", bg: "#fdeceb", text: "#b5392a" },
  aguardando_nf: { label: "Aguardando NF", bg: "#e8efff", text: "#2456b8" },
  nf_enviada: { label: "NF a validar", bg: "#e0f3f9", text: "#0f7d9e" },
  nf_rejeitada: { label: "NF rejeitada", bg: "#fdeceb", text: "#b5392a" },
  aguardando_pagamento: { label: "NF validada — a pagar", bg: "#e3f5ea", text: "#15754c" },
  pago_parcial: { label: "Pago parcialmente", bg: "#fff2de", text: "#a4650d" },
  encerrado: { label: "Pago — encerrado", bg: "#e3f5ea", text: "#15754c" },
};

const arredondar = (v: number) => Math.round(v * 100) / 100;

export function totalPago(f: Pick<FechamentoParceiro, "pagamentos">): number {
  return arredondar((f.pagamentos ?? []).reduce((s, p) => s + p.valor, 0));
}

/** Diferença entre o que foi pago e o valor calculado do fechamento (0 = conciliado). */
export function diferencaPagamento(f: Pick<FechamentoParceiro, "pagamentos" | "valor">): number {
  return arredondar(totalPago(f) - f.valor);
}

/**
 * Confirmação da parceira. No fluxo atual ela é a soma da confirmação de cada consultor (statusConsultores): qualquer
 * contestação trava; só confirma quando todos confirmaram. Documentos antigos usam a confirmação do responsável.
 */
export function confirmacaoDaParceira(f: FechamentoParceiro): ConfirmacaoFechamento {
  const mapa = f.statusConsultores;
  if (!mapa) return f.confirmacao;
  const valores = Object.values(mapa);
  if (valores.includes("contestado")) return { status: "contestado" };
  if (valores.length > 0 && valores.every((v) => v === "confirmado")) return { status: "confirmado" };
  return { status: "pendente" };
}

export function situacaoDaParceira(f: FechamentoParceiro): SituacaoParceiro {
  const conf = confirmacaoDaParceira(f).status;
  if (!f.statusConsultores && !f.ciencia?.em) return "aguardando_ciencia";
  if (conf === "contestado") return "contestado";
  if (conf !== "confirmado") return "aguardando_confirmacao";
  if (!f.nf) return "aguardando_nf";
  if (f.nf.status === "enviada") return "nf_enviada";
  if (f.nf.status === "rejeitada") return "nf_rejeitada";
  const pago = totalPago(f);
  if (pago <= 0) return "aguardando_pagamento";
  return pago >= f.valor - 0.005 ? "encerrado" : "pago_parcial";
}

/** Vencimento do pagamento do mês (mesma regra do relatório de fechamento). */
export function vencimentoDoMes(mesAno: string): string {
  const d = calcularVencimentoFechamento(mesAno);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Pagamento atrasado: NF validada, ainda não quitado e já passou do vencimento. */
export function pagamentoAtrasado(f: FechamentoParceiro, hojeIso: string): boolean {
  const s = situacaoDaParceira(f);
  return (s === "aguardando_pagamento" || s === "pago_parcial") && hojeIso > vencimentoDoMes(f.mesAno);
}

/** NF pendente: confirmada pela parceira, mas sem NF ou com NF ainda não validada. */
export function nfPendente(f: FechamentoParceiro): boolean {
  const s = situacaoDaParceira(f);
  return s === "aguardando_nf" || s === "nf_enviada" || s === "nf_rejeitada";
}

export const FORMAS_PAGAMENTO = ["TED", "boleto", "cheque"] as const;
