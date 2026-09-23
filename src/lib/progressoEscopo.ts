import { duracaoEmMinutos, idsFolhas } from "@/lib/escopo";
import { statusEfetivo } from "@/lib/statusHora";
import type { EscopoAtividade, EventoCalendario } from "@/types";

/** Progresso acumulado de uma atividade-folha do escopo, somando os apontamentos aprovados. */
export interface ProgressoFolha {
  horas: number;
  finalizada: boolean;
}

/** true quando o apontamento marcou as atividades como concluídas (sem o campo = apontamento antigo = concluído). */
export function apontamentoFinalizou(ev: Pick<EventoCalendario, "atividadesFinalizadas">): boolean {
  return ev.atividadesFinalizadas !== false;
}

/**
 * Reparte as horas de um apontamento entre as atividades-folha marcadas, proporcionalmente à duração
 * prevista de cada uma (ou igualmente, se alguma delas não tem duração). Assim marcar "Riscos" (8h
 * previstas) e apontar 4h dá 4h/8h no bloco, e apontar duas coisas de uma vez não conta as horas em dobro.
 */
export function distribuirHorasEvento(
  atividades: EscopoAtividade[],
  idsMarcados: Iterable<string>,
  totalHoras: number,
  folhas: Set<string> = idsFolhas(atividades)
): Map<string, number> {
  const marcados = new Set(idsMarcados);
  const alvo = atividades.filter((a) => folhas.has(a.id) && marcados.has(a.id));
  const resultado = new Map<string, number>();
  if (alvo.length === 0) return resultado;
  if (totalHoras <= 0) {
    alvo.forEach((a) => resultado.set(a.id, 0));
    return resultado;
  }
  const todasComDuracao = alvo.every((a) => duracaoEmMinutos(a) > 0);
  const pesos = alvo.map((a) => (todasComDuracao ? duracaoEmMinutos(a) : 1));
  const soma = pesos.reduce((acc, p) => acc + p, 0);
  alvo.forEach((a, i) => resultado.set(a.id, (totalHoras * pesos[i]) / soma));
  return resultado;
}

/**
 * Horas apontadas e situação (finalizada ou não) de cada atividade-folha, olhando só os apontamentos
 * aprovados do projeto. `ignorarEventoId` serve para simular "e se eu salvar este apontamento" sem
 * contar a versão antiga dele quando está sendo editado.
 */
export function calcularProgressoFolhas(
  projetoId: string,
  atividades: EscopoAtividade[],
  eventos: EventoCalendario[],
  ignorarEventoId?: string
): Map<string, ProgressoFolha> {
  const folhas = idsFolhas(atividades);
  const progresso = new Map<string, ProgressoFolha>();
  for (const ev of eventos) {
    if (ev.id === ignorarEventoId) continue;
    if (ev.projetoId !== projetoId) continue;
    if (statusEfetivo(ev) !== "aprovado") continue;
    const marcados = ev.atividadesRealizadas ?? [];
    if (marcados.length === 0) continue;
    const finalizou = apontamentoFinalizou(ev);
    for (const [id, horas] of distribuirHorasEvento(atividades, marcados, ev.totalHoras, folhas)) {
      const atual = progresso.get(id) ?? { horas: 0, finalizada: false };
      atual.horas += horas;
      if (finalizou) atual.finalizada = true;
      progresso.set(id, atual);
    }
  }
  return progresso;
}

/** 0 a 1: finalizada vale 1; em andamento vale horas apontadas / previstas (0 se não há duração para medir). */
export function fracaoDaFolha(atividade: EscopoAtividade, progresso: ProgressoFolha | undefined): number {
  if (progresso?.finalizada) return 1;
  const previstas = duracaoEmMinutos(atividade) / 60;
  if (!progresso || previstas <= 0) return 0;
  return Math.min(1, progresso.horas / previstas);
}
