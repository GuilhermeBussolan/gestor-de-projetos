import { STATUS_DOCUMENTO_CONFIG } from "@/lib/constants";
import type { DocumentoProjeto, EventoCalendario, Recurso } from "@/types";

/**
 * Peso relativo de cada documento = peso individual / soma dos pesos dos documentos
 * presentes no projeto * 100, garantindo que a soma feche em 100%.
 * Percentual final = soma de (peso relativo * fator do status).
 */
export function calcularPercentualProjeto(documentos: DocumentoProjeto[]): number {
  if (documentos.length === 0) return 0;

  const somaPesos = documentos.reduce((acc, d) => acc + d.pesoIndividual, 0);
  if (somaPesos === 0) return 0;

  const percentual = documentos.reduce((acc, d) => {
    const pesoRelativo = (d.pesoIndividual / somaPesos) * 100;
    const fator = STATUS_DOCUMENTO_CONFIG[d.status].fator;
    return acc + pesoRelativo * fator;
  }, 0);

  return Math.round(percentual * 100) / 100;
}

export function corFaixaProgresso(percentual: number): string {
  if (percentual >= 100) return "#92D050";
  if (percentual >= 50) return "#0F9ED5";
  if (percentual >= 1) return "#CCFF66";
  return "#EE0000";
}

export interface HorasRealizadas {
  consultor: number;
  coordenador: number;
}

/**
 * Soma as horas já efetivamente trabalhadas num projeto, separadas por papel.
 * Conta lançamentos avulsos (sempre) e ocorrências de recorrência já confirmadas
 * como "realizada" — ocorrências pendentes ou canceladas não contam.
 */
export function calcularHorasRealizadas(
  projetoId: string,
  eventos: EventoCalendario[],
  recursos: Recurso[]
): HorasRealizadas {
  const resultado: HorasRealizadas = { consultor: 0, coordenador: 0 };
  for (const ev of eventos) {
    if (ev.projetoId !== projetoId) continue;
    if (ev.origem === "recorrencia" && ev.status !== "realizada") continue;
    const recurso = recursos.find((r) => r.id === ev.recursoId);
    if (!recurso) continue;
    if (recurso.tipo === "coordenador") resultado.coordenador += ev.totalHoras;
    else resultado.consultor += ev.totalHoras;
  }
  return resultado;
}
