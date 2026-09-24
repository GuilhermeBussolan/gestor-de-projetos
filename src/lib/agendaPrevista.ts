import { todasAlocacoes } from "@/lib/cronograma";
import { turnoDaHora } from "@/lib/cronograma";
import { apontamentoFinalizou } from "@/lib/progressoEscopo";
import { statusEfetivo } from "@/lib/statusHora";
import type { EventoCalendario, PeriodoDia, Projeto } from "@/types";

export type SituacaoPrevisto = "a_fazer" | "hoje" | "atrasada" | "apontada";

/** O que os cronogramas preveem para um recurso num projeto, num dia e turno. */
export interface PrevistoCronograma {
  chave: string;
  data: string;
  periodo: PeriodoDia;
  projetoId: string;
  recursoId: string;
  atividadeIds: string[];
  nomes: string[];
  horas: number;
  situacao: SituacaoPrevisto;
}

/**
 * A agenda prevista pelos cronogramas dos projetos ativos, um item por (recurso, projeto, dia, turno).
 * É calculada na hora — nada é gravado — e acompanha as novas versões do cronograma.
 *
 * Situação: "apontada" quando já existe apontamento (não cancelado/rejeitado) do mesmo recurso e
 * projeto naquele dia e turno, ou quando todas as tarefas do item já foram concluídas; senão
 * "atrasada" (a data passou), "hoje" ou "a_fazer".
 */
export function previstosDoCronograma({
  projetos,
  eventos,
  hojeIso,
  recursoIds,
}: {
  projetos: Projeto[];
  eventos: EventoCalendario[];
  hojeIso: string;
  /** Restringe a estes recursos (ex: só o consultor logado). Omitido = todos. */
  recursoIds?: Set<string>;
}): PrevistoCronograma[] {
  const concluidas = new Set<string>();
  for (const e of eventos) {
    const st = statusEfetivo(e);
    if ((st === "aprovado" || st === "aguardando_aprovacao") && apontamentoFinalizou(e)) {
      (e.atividadesRealizadas ?? []).forEach((id) => concluidas.add(id));
    }
  }
  const jaApontado = new Set(
    eventos
      .filter((e) => !e.retroativo && statusEfetivo(e) !== "cancelado" && statusEfetivo(e) !== "rejeitado")
      .map((e) => `${e.recursoId}|${e.projetoId}|${e.data}|${turnoDaHora(e.horaInicio)}`)
  );

  const ativos = projetos.filter((p) => (p.status ?? "ativo") === "ativo");
  const grupos = new Map<string, PrevistoCronograma & { horasPorAtividade: Map<string, number> }>();
  for (const aloc of todasAlocacoes(ativos)) {
    if (recursoIds && !recursoIds.has(aloc.recursoId)) continue;
    for (const bloco of aloc.blocos) {
      const chave = `${aloc.recursoId}|${aloc.projetoId}|${bloco.data}|${bloco.periodo}`;
      const g =
        grupos.get(chave) ??
        {
          chave,
          data: bloco.data,
          periodo: bloco.periodo,
          projetoId: aloc.projetoId,
          recursoId: aloc.recursoId,
          atividadeIds: [],
          nomes: [],
          horas: 0,
          situacao: "a_fazer" as SituacaoPrevisto,
          horasPorAtividade: new Map<string, number>(),
        };
      if (!g.atividadeIds.includes(aloc.atividadeId)) {
        g.atividadeIds.push(aloc.atividadeId);
        g.nomes.push(aloc.atividadeDescricao);
      }
      g.horasPorAtividade.set(aloc.atividadeId, (g.horasPorAtividade.get(aloc.atividadeId) ?? 0) + bloco.horas);
      g.horas += bloco.horas;
      grupos.set(chave, g);
    }
  }

  return Array.from(grupos.values()).map((g) => {
    const { horasPorAtividade, ...item } = g;
    const pendentes = item.atividadeIds.filter((id) => !concluidas.has(id));
    if (jaApontado.has(item.chave) || pendentes.length === 0) {
      return { ...item, situacao: "apontada" as SituacaoPrevisto };
    }
    // Só o que ainda falta fazer no turno.
    const nomes = item.atividadeIds.flatMap((id, i) => (concluidas.has(id) ? [] : [item.nomes[i]]));
    const horas = pendentes.reduce((s, id) => s + (horasPorAtividade.get(id) ?? 0), 0);
    const situacao: SituacaoPrevisto = item.data < hojeIso ? "atrasada" : item.data === hojeIso ? "hoje" : "a_fazer";
    return { ...item, atividadeIds: pendentes, nomes, horas, situacao };
  });
}
