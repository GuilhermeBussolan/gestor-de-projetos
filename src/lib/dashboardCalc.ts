import { fimDoBloco, idsFolhas, somaDuracaoBloco } from "@/lib/escopo";
import { statusEfetivo } from "@/lib/statusHora";
import type { AbaStatusProjeto, EscopoAtividade, EventoCalendario, Projeto, Recurso } from "@/types";

/**
 * Percentual do projeto = andamento do escopo, não mais dos documentos (MITs): quantas
 * atividades-folha já foram marcadas como feitas (num apontamento aprovado do Calendário) sobre o
 * total de folhas do escopo — cada atividade conta 1 a 1, não pesa pela duração dela (uma tarefa
 * de 20h concluída avança o percentual igual a uma de 1h). Sem nenhuma atividade no escopo, o
 * projeto é 0% (a iniciar).
 */
export function calcularPercentualProjeto(
  projeto: Pick<Projeto, "id" | "escopoAtividades">,
  eventos: EventoCalendario[]
): number {
  const atividades = projeto.escopoAtividades ?? [];
  const folhas = idsFolhas(atividades);
  const folhasEscopo = atividades.filter((a) => folhas.has(a.id));
  if (folhasEscopo.length === 0) return 0;

  const concluidas = calcularAtividadesConcluidas(projeto.id, eventos);
  const feitas = folhasEscopo.filter((a) => concluidas.has(a.id)).length;
  return Math.round((feitas / folhasEscopo.length) * 10000) / 100;
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

export interface RegistroAtividade {
  data: string;
  /** Nomes dos recursos que apontaram essa atividade nessa data (join quando mais de um). */
  recursoNome: string;
}

/**
 * Como `calcularDatasAtividades`, mas junto com o nome do(s) recurso(s) que apontaram cada
 * atividade em cada data — pra mostrar "quem fez o quê e quando" no escopo do projeto.
 */
export function calcularRegistrosAtividades(
  projetoId: string,
  eventos: EventoCalendario[],
  recursos: Recurso[]
): Map<string, RegistroAtividade[]> {
  const mapa = new Map<string, Map<string, Set<string>>>();
  for (const ev of eventos) {
    if (ev.projetoId !== projetoId) continue;
    if (statusEfetivo(ev) !== "aprovado") continue;
    const recursoNome = recursos.find((r) => r.id === ev.recursoId)?.nomeCompleto ?? "—";
    for (const id of ev.atividadesRealizadas ?? []) {
      if (!mapa.has(id)) mapa.set(id, new Map());
      const porData = mapa.get(id)!;
      if (!porData.has(ev.data)) porData.set(ev.data, new Set());
      porData.get(ev.data)!.add(recursoNome);
    }
  }
  const resultado = new Map<string, RegistroAtividade[]>();
  for (const [id, porData] of mapa) {
    const registros = [...porData.entries()]
      .sort(([dataA], [dataB]) => dataA.localeCompare(dataB))
      .map(([data, nomes]) => ({ data, recursoNome: [...nomes].sort().join(", ") }));
    resultado.set(id, registros);
  }
  return resultado;
}

/**
 * IDs das atividades do escopo já marcadas como feitas em algum apontamento
 * aprovado do projeto — a mesma régua de "aprovado" usada nas horas.
 */
export function calcularAtividadesConcluidas(
  projetoId: string,
  eventos: EventoCalendario[],
  ignorarEventoId?: string
): Set<string> {
  const concluidas = new Set<string>();
  for (const ev of eventos) {
    if (ev.id === ignorarEventoId) continue;
    if (ev.projetoId !== projetoId) continue;
    if (statusEfetivo(ev) !== "aprovado") continue;
    (ev.atividadesRealizadas ?? []).forEach((id) => concluidas.add(id));
  }
  return concluidas;
}

/** true se todas as atividades-folha do bloco em `indiceGrupo` estão no conjunto de concluídas. */
export function grupoConcluido(
  atividades: EscopoAtividade[],
  indiceGrupo: number,
  concluidas: Set<string>
): boolean {
  const folhas = idsFolhas(atividades);
  const fim = fimDoBloco(atividades, indiceGrupo);
  const idsDoGrupo = atividades.slice(indiceGrupo, fim).filter((a) => folhas.has(a.id)).map((a) => a.id);
  return idsDoGrupo.length > 0 && idsDoGrupo.every((id) => concluidas.has(id));
}

/**
 * Horas Realizadas (Grupo): soma o totalHoras de todo apontamento aprovado que marcou qualquer
 * atividade-folha dentro do bloco do "grupo de rotina" (a atividade em `indiceGrupo`) como feita.
 * Um apontamento que marca folhas de mais de um grupo conta integralmente em cada um — a mesma
 * aproximação já usada para "atividades concluídas", já que o apontamento não fatia as horas por
 * atividade. `ignorarEventoId` serve para simular "e se eu salvar este apontamento", sem contar
 * a versão antiga dele quando está sendo editado.
 */
export function calcularHorasRealizadasGrupo(
  projetoId: string,
  atividades: EscopoAtividade[],
  indiceGrupo: number,
  eventos: EventoCalendario[],
  ignorarEventoId?: string
): number {
  const folhas = idsFolhas(atividades);
  const fim = fimDoBloco(atividades, indiceGrupo);
  const idsDoGrupo = new Set(
    atividades.slice(indiceGrupo, fim).filter((a) => folhas.has(a.id)).map((a) => a.id)
  );
  let total = 0;
  for (const ev of eventos) {
    if (ev.id === ignorarEventoId) continue;
    if (ev.projetoId !== projetoId) continue;
    if (statusEfetivo(ev) !== "aprovado") continue;
    if ((ev.atividadesRealizadas ?? []).some((id) => idsDoGrupo.has(id))) total += ev.totalHoras;
  }
  return total;
}

/** Horas aprovadas de eventos que marcaram esta atividade-folha específica como feita. */
export function calcularHorasRealizadasAtividade(
  projetoId: string,
  atividadeId: string,
  eventos: EventoCalendario[]
): number {
  let total = 0;
  for (const ev of eventos) {
    if (ev.projetoId !== projetoId) continue;
    if (statusEfetivo(ev) !== "aprovado") continue;
    if ((ev.atividadesRealizadas ?? []).includes(atividadeId)) total += ev.totalHoras;
  }
  return total;
}

export interface ResumoGrupoRotina {
  grupoId: string;
  descricao: string;
  indice: number;
  horasPrevistas: number;
  horasRealizadas: number;
  diferenca: number;
  percentualRealizado: number;
  /** Todas as atividades-folha do grupo já foram marcadas como feitas — mesmo com menos horas que o previsto. */
  concluido: boolean;
}

/** Um resumo Previsto x Realizado por grupo de rotina (atividade de nível 0) do escopo do projeto. */
export function resumoGruposRotina(
  projetoId: string,
  atividades: EscopoAtividade[],
  eventos: EventoCalendario[]
): ResumoGrupoRotina[] {
  const concluidas = calcularAtividadesConcluidas(projetoId, eventos);
  return atividades
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => (a.nivel ?? 0) === 0)
    .map(({ a, i }) => {
      const horasPrevistas = somaDuracaoBloco(atividades, i) / 60;
      const horasRealizadas = calcularHorasRealizadasGrupo(projetoId, atividades, i, eventos);
      const concluido = grupoConcluido(atividades, i, concluidas);
      return {
        grupoId: a.id,
        descricao: a.descricao,
        indice: i,
        horasPrevistas,
        horasRealizadas,
        diferenca: horasRealizadas - horasPrevistas,
        percentualRealizado: concluido
          ? 100
          : horasPrevistas > 0
            ? Math.round((horasRealizadas / horasPrevistas) * 1000) / 10
            : 0,
        concluido,
      };
    });
}
