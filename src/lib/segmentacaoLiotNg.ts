import type { Projeto } from "@/types";

/** LIOT = propostas dos módulos QRH e KPH; NG = todos os outros módulos. */
export type SegmentoLiotNg = "LIOT" | "NG";

export const SEGMENTO_CONFIG: Record<SegmentoLiotNg, { label: string; descricao: string; cor: string; corSuave: string }> = {
  LIOT: { label: "LIOT", descricao: "Módulos QRH e KPH", cor: "#2f6fe4", corSuave: "#e8efff" },
  NG: { label: "NG", descricao: "Demais módulos", cor: "#152849", corSuave: "#e6eaf2" },
};

export function segmentoDoModulo(modulo: string): SegmentoLiotNg {
  return modulo === "QRH" || modulo === "KPH" ? "LIOT" : "NG";
}

export interface ResumoSegmento {
  segmento: SegmentoLiotNg;
  projetos: number;
  /** Valor total de venda das propostas do segmento. */
  totalVenda: number;
  /** Vendido: parcelas liberadas, faturadas ou já recebidas. */
  vendido: number;
  /** Já recebido. */
  recebido: number;
}

/**
 * Soma por segmento (LIOT x NG): total de venda -> vendido (liberado/faturado/recebido) -> recebido.
 * Parcela cancelada não conta como vendida. No banco de horas o "total de venda" é o valor de venda do contrato.
 */
export function segmentarLiotNg(projetos: Pick<Projeto, "modulo" | "financeiro">[]): Record<SegmentoLiotNg, ResumoSegmento> {
  const vazio = (segmento: SegmentoLiotNg): ResumoSegmento => ({ segmento, projetos: 0, totalVenda: 0, vendido: 0, recebido: 0 });
  const resumo = { LIOT: vazio("LIOT"), NG: vazio("NG") };
  for (const p of projetos) {
    const alvo = resumo[segmentoDoModulo(p.modulo)];
    alvo.projetos += 1;
    alvo.totalVenda += p.financeiro?.valorTotal ?? 0;
    for (const parc of p.financeiro?.parcelas ?? []) {
      if (parc.status === "LIBERADO" || parc.status === "FATURADO" || parc.status === "RECEBIDO") alvo.vendido += parc.valor;
      if (parc.status === "RECEBIDO") alvo.recebido += parc.valor;
    }
  }
  return resumo;
}
