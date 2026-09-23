import { fimDoBloco, idsFolhas, somaDuracaoBloco } from "@/lib/escopo";
import { horasApontadasNoBloco } from "@/lib/dashboardCalc";
import { calcularProgressoFolhas, distribuirHorasEvento } from "@/lib/progressoEscopo";
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

/** Alerta adicional (não bloqueia) quando o excedente passa de 20% do previsto. */
export function excedeu20PorCento(previsto: number, realizado: number): boolean {
  return previsto > 0 && realizado > previsto * 1.2 + EPSILON;
}

export const MENSAGEM_CENARIO: Record<CenarioComparativo, string> = {
  abaixo: "Atenção: o apontamento está abaixo das horas previstas para esta atividade.",
  dentro: "Apontamento concluído. As horas realizadas estão de acordo com o previsto.",
  acima: "Atenção: as horas apontadas ultrapassaram o previsto para esta atividade.",
};

/** Situação de um apontamento frente ao previsto da atividade que ele marcou. */
export type CenarioApontamento = "andamento" | "dentro" | "acima";

export interface ComparativoBloco {
  blocoId: string;
  /** A atividade selecionada (ex: "Riscos") — não o grupo de rotina que a contém. */
  descricao: string;
  horasPrevistas: number;
  /** Já contando o que está sendo salvo agora. */
  horasRealizadas: number;
  diferenca: number;
  /** Quanto da atividade fica feito: 100 se finalizada, senão horas/previstas. */
  percentual: number;
  cenario: CenarioApontamento;
  excedeu20: boolean;
  finalizado: boolean;
}

/**
 * Atividades "inteiras" que a seleção cobre: os blocos mais altos cujas folhas estão todas marcadas.
 * Marcar "Riscos" (com todos os filhos) dá o bloco Riscos; marcar só duas folhas dele dá cada folha.
 */
export function indicesBlocosMarcados(atividades: EscopoAtividade[], idsMarcadas: string[]): number[] {
  const folhas = idsFolhas(atividades);
  const marcados = new Set(idsMarcadas);
  const blocos: number[] = [];
  let ate = -1;
  for (let i = 0; i < atividades.length; i++) {
    if (i < ate) continue;
    const fim = fimDoBloco(atividades, i);
    const folhasDoBloco = atividades.slice(i, fim).filter((a) => folhas.has(a.id));
    if (folhasDoBloco.length > 0 && folhasDoBloco.every((a) => marcados.has(a.id))) {
      blocos.push(i);
      ate = fim;
    }
  }
  return blocos;
}

/**
 * Para cada atividade marcada num apontamento, simula o previsto x realizado SE ele for salvo: soma o
 * que já está aprovado à parte das horas deste apontamento que cabe àquela atividade. Com
 * `finalizado` falso o apontamento é "em andamento" (4h de 8h = 50%, faltam apontamentos); com ele
 * verdadeiro a atividade conta como concluída, mesmo que tenha levado menos horas que o previsto.
 * `ignorarEventoId` evita contar duas vezes o próprio apontamento quando ele está sendo editado.
 */
export function avaliarBlocosAoApontar(
  projetoId: string,
  atividades: EscopoAtividade[],
  idsMarcadas: string[],
  totalHorasEvento: number,
  finalizado: boolean,
  eventos: EventoCalendario[],
  ignorarEventoId?: string
): ComparativoBloco[] {
  const folhas = idsFolhas(atividades);
  const antes = calcularProgressoFolhas(projetoId, atividades, eventos, ignorarEventoId);
  const deste = distribuirHorasEvento(atividades, idsMarcadas, totalHorasEvento, folhas);

  return indicesBlocosMarcados(atividades, idsMarcadas).map((indice) => {
    const bloco = atividades[indice];
    const horasPrevistas = somaDuracaoBloco(atividades, indice) / 60;
    const horasDeste = atividades
      .slice(indice, fimDoBloco(atividades, indice))
      .filter((a) => folhas.has(a.id))
      .reduce((soma, a) => soma + (deste.get(a.id) ?? 0), 0);
    const horasRealizadas = horasApontadasNoBloco(atividades, indice, antes) + horasDeste;
    const excedeu = horasPrevistas > 0 && horasRealizadas > horasPrevistas + EPSILON;
    return {
      blocoId: bloco.id,
      descricao: bloco.descricao,
      horasPrevistas,
      horasRealizadas,
      diferenca: horasRealizadas - horasPrevistas,
      percentual: finalizado
        ? 100
        : horasPrevistas > 0
          ? Math.min(100, Math.round((horasRealizadas / horasPrevistas) * 1000) / 10)
          : 0,
      cenario: excedeu ? "acima" : finalizado ? "dentro" : "andamento",
      excedeu20: excedeu20PorCento(horasPrevistas, horasRealizadas),
      finalizado,
    };
  });
}
