import { indiceGrupoDaAtividade } from "@/lib/cronograma";
import { calcularAtividadesConcluidas, calcularHorasRealizadasGrupo, grupoConcluido } from "@/lib/dashboardCalc";
import { somaDuracaoBloco } from "@/lib/escopo";
import type { EscopoAtividade, EventoCalendario } from "@/types";

export type CenarioComparativo = "abaixo" | "dentro" | "acima";

const EPSILON = 0.01;

/** Sem horas previstas cadastradas, qualquer hora apontada já conta como "acima" (não há o que comparar). */
export function classificarCenario(previsto: number, realizado: number): CenarioComparativo {
  if (previsto <= 0) return realizado > 0 ? "acima" : "dentro";
  if (realizado < previsto - EPSILON) return "abaixo";
  if (realizado > previsto + EPSILON) return "acima";
  return "dentro";
}

/** Alerta adicional (não bloqueia) quando o excedente passa de 20% do previsto do grupo. */
export function excedeu20PorCento(previsto: number, realizado: number): boolean {
  return previsto > 0 && realizado > previsto * 1.2 + EPSILON;
}

export const MENSAGEM_CENARIO: Record<CenarioComparativo, string> = {
  abaixo: "Atenção: o apontamento está abaixo das horas previstas para esta atividade.",
  dentro: "Apontamento concluído. As horas realizadas estão de acordo com o previsto.",
  acima: "Atenção: as horas apontadas ultrapassaram o previsto para esta atividade.",
};

export interface ComparativoGrupo {
  grupoId: string;
  descricao: string;
  horasPrevistas: number;
  /** Já contando o que está sendo salvo agora. */
  horasRealizadas: number;
  diferenca: number;
  cenario: CenarioComparativo;
  excedeu20: boolean;
  /** Todas as folhas do grupo ficariam marcadas como feitas se este apontamento for salvo. */
  concluido: boolean;
}

/**
 * Para cada "grupo de rotina" tocado pelas atividades marcadas num apontamento, simula o que as
 * Horas Realizadas do grupo ficariam SE este apontamento for salvo (soma ao que já está aprovado).
 * `ignorarEventoId` evita contar duas vezes o próprio apontamento quando ele está sendo editado.
 */
export function avaliarGruposAoApontar(
  projetoId: string,
  atividades: EscopoAtividade[],
  idsMarcadas: string[],
  totalHorasEvento: number,
  eventos: EventoCalendario[],
  ignorarEventoId?: string
): ComparativoGrupo[] {
  const indicesGrupo = new Set<number>();
  idsMarcadas.forEach((id) => {
    const indice = atividades.findIndex((a) => a.id === id);
    if (indice >= 0) indicesGrupo.add(indiceGrupoDaAtividade(atividades, indice));
  });

  // Simula o conjunto de concluídas COM este apontamento salvo: soma o que já está aprovado
  // (exceto a versão antiga dele, se for edição) às atividades marcadas agora.
  const concluidasSemEste = calcularAtividadesConcluidas(projetoId, eventos, ignorarEventoId);
  const concluidasComEste = new Set([...concluidasSemEste, ...idsMarcadas]);

  return [...indicesGrupo].map((indice) => {
    const grupo = atividades[indice];
    const horasPrevistas = somaDuracaoBloco(atividades, indice) / 60;
    const antes = calcularHorasRealizadasGrupo(projetoId, atividades, indice, eventos, ignorarEventoId);
    const horasRealizadas = antes + totalHorasEvento;
    const concluido = grupoConcluido(atividades, indice, concluidasComEste);
    return {
      grupoId: grupo.id,
      descricao: grupo.descricao,
      horasPrevistas,
      horasRealizadas,
      diferenca: horasRealizadas - horasPrevistas,
      cenario: concluido ? "dentro" : classificarCenario(horasPrevistas, horasRealizadas),
      excedeu20: excedeu20PorCento(horasPrevistas, horasRealizadas),
      concluido,
    };
  });
}
