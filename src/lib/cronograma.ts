import { duracaoEmMinutos, idsFolhas, nivelAtividade } from "@/lib/escopo";
import { horaParaMinutos } from "@/lib/horas";
import type { EscopoAtividade, PeriodoDia, Projeto, Recurso } from "@/types";

/** Mesma janela usada nos botões +M/+T do calendário. */
export const HORARIO_PERIODO: Record<PeriodoDia, { horaInicio: string; horaFim: string }> = {
  manha: { horaInicio: "08:00", horaFim: "12:00" },
  tarde: { horaInicio: "13:00", horaFim: "17:00" },
};

export const PERIODO_LABEL: Record<PeriodoDia, string> = {
  manha: "Manhã",
  tarde: "Tarde",
};

/** Uma atividade do cronograma com alocação completa (folha, recurso, data e período definidos). */
export interface AlocacaoAtividade {
  projetoId: string;
  projetoNome: string;
  atividadeId: string;
  atividadeDescricao: string;
  /** Descrição do "grupo de rotina" — a atividade raiz (nível 0) que contém esta tarefa. */
  grupoDescricao: string;
  recursoId: string;
  data: string;
  periodo: PeriodoDia;
  horaInicio: string;
  horaFim: string;
  horasPrevistas: number;
}

/** Índice do "grupo de rotina" (ancestral de nível 0) ao qual a atividade em `indice` pertence. */
export function indiceGrupoDaAtividade(atividades: EscopoAtividade[], indice: number): number {
  for (let i = indice; i >= 0; i--) {
    if (nivelAtividade(atividades[i]) === 0) return i;
  }
  return indice;
}

function horasDaAtividade(a: Pick<EscopoAtividade, "duracao" | "unidadeDuracao">): number {
  return duracaoEmMinutos(a) / 60;
}

/** Todas as alocações previstas de um projeto — só atividades-folha com recurso, data e período. */
export function alocacoesDoProjeto(projeto: Pick<Projeto, "id" | "codigoProposta" | "escopoAtividades">): AlocacaoAtividade[] {
  const atividades = projeto.escopoAtividades ?? [];
  const folhas = idsFolhas(atividades);
  const alocacoes: AlocacaoAtividade[] = [];
  atividades.forEach((a, i) => {
    if (!folhas.has(a.id) || !a.recursoId || !a.dataInicio || !a.periodo) return;
    const { horaInicio, horaFim } = HORARIO_PERIODO[a.periodo];
    alocacoes.push({
      projetoId: projeto.id,
      projetoNome: projeto.codigoProposta,
      atividadeId: a.id,
      atividadeDescricao: a.descricao,
      grupoDescricao: atividades[indiceGrupoDaAtividade(atividades, i)]?.descricao ?? a.descricao,
      recursoId: a.recursoId,
      data: a.dataInicio,
      periodo: a.periodo,
      horaInicio,
      horaFim,
      horasPrevistas: horasDaAtividade(a),
    });
  });
  return alocacoes;
}

export interface ProximoAtendimento {
  tipo: "agendado" | "atrasado" | "sem_cronograma" | "concluido";
  data?: string;
  periodo?: PeriodoDia;
  recursoNome?: string;
  atividadeDescricao?: string;
  grupoDescricao?: string;
  horasPrevistas?: number;
}

/**
 * Próxima alocação prevista do projeto que ainda não foi marcada como feita (via apontamento
 * aprovado) — pro card do dashboard mostrar "quando é o próximo atendimento" sem abrir o projeto.
 * `concluidas` vem de `calcularAtividadesConcluidas`; sem nenhuma alocação no escopo (cronograma
 * não importado) cai em "sem_cronograma", e sem nenhuma pendente cai em "concluido".
 */
export function calcularProximoAtendimento(
  projeto: Pick<Projeto, "id" | "codigoProposta" | "escopoAtividades">,
  concluidas: Set<string>,
  recursos: Recurso[],
  hojeIso: string
): ProximoAtendimento {
  // Só exige recurso + data (não período): muitos cronogramas reais (ex: exports de Gantt) não
  // têm coluna de período, e ainda assim já dá pra saber quando é o próximo atendimento.
  const atividades = projeto.escopoAtividades ?? [];
  const folhas = idsFolhas(atividades);
  const agendadas = atividades
    .map((a, indice) => ({ a, indice }))
    .filter(({ a }) => folhas.has(a.id) && a.recursoId && a.dataInicio);
  if (agendadas.length === 0) return { tipo: "sem_cronograma" };

  const pendentes = agendadas
    .filter(({ a }) => !concluidas.has(a.id))
    .sort((x, y) => {
      if (x.a.dataInicio !== y.a.dataInicio) return x.a.dataInicio! < y.a.dataInicio! ? -1 : 1;
      return (x.a.periodo ?? "").localeCompare(y.a.periodo ?? "");
    });

  if (pendentes.length === 0) return { tipo: "concluido" };

  const { a: proxima, indice } = pendentes[0];
  return {
    tipo: proxima.dataInicio! < hojeIso ? "atrasado" : "agendado",
    data: proxima.dataInicio!,
    periodo: proxima.periodo ?? undefined,
    recursoNome: recursos.find((r) => r.id === proxima.recursoId)?.nomeCompleto ?? "—",
    atividadeDescricao: proxima.descricao,
    grupoDescricao: atividades[indiceGrupoDaAtividade(atividades, indice)]?.descricao,
    horasPrevistas: horasDaAtividade(proxima),
  };
}

/** Todas as alocações previstas de todos os projetos — a base do Mapa de Alocação. */
export function todasAlocacoes(
  projetos: Pick<Projeto, "id" | "codigoProposta" | "escopoAtividades">[]
): AlocacaoAtividade[] {
  return projetos.flatMap((p) => alocacoesDoProjeto(p));
}

function sobrepoe(a: AlocacaoAtividade, b: AlocacaoAtividade): boolean {
  return a.recursoId === b.recursoId && a.data === b.data && horaParaMinutos(a.horaInicio) < horaParaMinutos(b.horaFim) && horaParaMinutos(b.horaInicio) < horaParaMinutos(a.horaFim);
}

/**
 * IDs das atividades cuja alocação prevista colide com a de outra atividade do mesmo recurso, no
 * mesmo dia (mesmo entre projetos diferentes) — a "Sobreposição de agenda" da seção 2.
 */
export function idsAtividadesSobrepostas(alocacoes: AlocacaoAtividade[]): Set<string> {
  const sobrepostas = new Set<string>();
  for (let i = 0; i < alocacoes.length; i++) {
    for (let j = i + 1; j < alocacoes.length; j++) {
      if (alocacoes[i].atividadeId === alocacoes[j].atividadeId) continue;
      if (sobrepoe(alocacoes[i], alocacoes[j])) {
        sobrepostas.add(alocacoes[i].atividadeId);
        sobrepostas.add(alocacoes[j].atividadeId);
      }
    }
  }
  return sobrepostas;
}

/** As outras alocações que colidem com `alocacao` — para explicar o conflito ao usuário. */
export function conflitosDe(alocacao: AlocacaoAtividade, todas: AlocacaoAtividade[]): AlocacaoAtividade[] {
  return todas.filter((outra) => outra.atividadeId !== alocacao.atividadeId && sobrepoe(alocacao, outra));
}

export function nomeRecurso(recursoId: string, recursos: Pick<Recurso, "id" | "nomeCompleto">[]): string {
  return recursos.find((r) => r.id === recursoId)?.nomeCompleto ?? "Recurso removido";
}

export function somarDiasIso(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Todos os dias (YYYY-MM-DD) entre `inicio` e `fim`, inclusive. */
export function diasDoIntervalo(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  for (let atual = inicio; atual <= fim; atual = somarDiasIso(atual, 1)) dias.push(atual);
  return dias;
}

/** Segunda-feira da semana que contém `dataIso`. */
export function inicioDaSemana(dataIso: string): string {
  const diaSemana = new Date(`${dataIso}T12:00:00`).getDay(); // 0 = domingo
  const deslocamento = diaSemana === 0 ? -6 : 1 - diaSemana;
  return somarDiasIso(dataIso, deslocamento);
}

export function diasDoMes(ano: number, mes1a12: number): string[] {
  const inicio = `${ano}-${String(mes1a12).padStart(2, "0")}-01`;
  const ultimoDia = new Date(ano, mes1a12, 0).getDate();
  const fim = `${ano}-${String(mes1a12).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return diasDoIntervalo(inicio, fim);
}

export type StatusCelulaMapa = "livre" | "alocado" | "sobreposicao";

export interface CelulaMapaAlocacao {
  status: StatusCelulaMapa;
  alocacoes: AlocacaoAtividade[];
}

/** A matriz recurso x dia do Mapa de Alocação (seção 7). */
export function montarMapaAlocacao(
  alocacoes: AlocacaoAtividade[],
  sobrepostas: Set<string>,
  recursoIds: string[],
  dias: string[]
): Map<string, Map<string, CelulaMapaAlocacao>> {
  const mapa = new Map<string, Map<string, CelulaMapaAlocacao>>();
  for (const recursoId of recursoIds) {
    const porDia = new Map<string, CelulaMapaAlocacao>();
    for (const dia of dias) {
      const doDia = alocacoes.filter((a) => a.recursoId === recursoId && a.data === dia);
      const status: StatusCelulaMapa =
        doDia.length === 0 ? "livre" : doDia.some((a) => sobrepostas.has(a.atividadeId)) ? "sobreposicao" : "alocado";
      porDia.set(dia, { status, alocacoes: doDia });
    }
    mapa.set(recursoId, porDia);
  }
  return mapa;
}
