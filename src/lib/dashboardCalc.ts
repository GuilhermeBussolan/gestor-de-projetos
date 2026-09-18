import { STATUS_DOCUMENTO_CONFIG } from "@/lib/constants";
import { statusEfetivo } from "@/lib/statusHora";
import type { AbaStatusProjeto, DocumentoProjeto, EventoCalendario, Projeto, Recurso } from "@/types";

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

/**
 * Classifica um projeto pra abas do dashboard: cancelado tem prioridade sobre
 * o percentual; senão, 0% = a iniciar, 100% = concluído, senão em andamento.
 */
export function statusAbaProjeto(projeto: Pick<Projeto, "status">, percentual: number): AbaStatusProjeto {
  if (projeto.status === "cancelado") return "cancelados";
  if (percentual <= 0) return "a_iniciar";
  if (percentual >= 100) return "concluidos";
  return "em_andamento";
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
 * Só conta lançamentos com status "aprovado" — é a única situação que a
 * spec considera "real" para os cálculos do projeto.
 */
export function calcularHorasRealizadas(
  projetoId: string,
  eventos: EventoCalendario[],
  recursos: Recurso[]
): HorasRealizadas {
  const resultado: HorasRealizadas = { consultor: 0, coordenador: 0 };
  for (const ev of eventos) {
    if (ev.projetoId !== projetoId) continue;
    if (statusEfetivo(ev) !== "aprovado") continue;
    const recurso = recursos.find((r) => r.id === ev.recursoId);
    if (!recurso) continue;
    if (recurso.tipo === "coordenador") resultado.coordenador += ev.totalHoras;
    else resultado.consultor += ev.totalHoras;
  }
  return resultado;
}

/**
 * Datas (YYYY-MM-DD, únicas e em ordem) em que cada atividade do escopo foi
 * apontada em lançamentos aprovados do projeto.
 */
export function calcularDatasAtividades(
  projetoId: string,
  eventos: EventoCalendario[]
): Map<string, string[]> {
  const mapa = new Map<string, Set<string>>();
  for (const ev of eventos) {
    if (ev.projetoId !== projetoId) continue;
    if (statusEfetivo(ev) !== "aprovado") continue;
    for (const id of ev.atividadesRealizadas ?? []) {
      if (!mapa.has(id)) mapa.set(id, new Set());
      mapa.get(id)!.add(ev.data);
    }
  }
  return new Map([...mapa.entries()].map(([id, datas]) => [id, [...datas].sort()]));
}

/**
 * IDs das atividades do escopo já marcadas como feitas em algum apontamento
 * aprovado do projeto — a mesma régua de "aprovado" usada nas horas.
 */
export function calcularAtividadesConcluidas(
  projetoId: string,
  eventos: EventoCalendario[]
): Set<string> {
  const concluidas = new Set<string>();
  for (const ev of eventos) {
    if (ev.projetoId !== projetoId) continue;
    if (statusEfetivo(ev) !== "aprovado") continue;
    (ev.atividadesRealizadas ?? []).forEach((id) => concluidas.add(id));
  }
  return concluidas;
}
