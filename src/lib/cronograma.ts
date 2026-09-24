import { duracaoEmMinutos, idsFolhas, nivelAtividade } from "@/lib/escopo";
import { horaParaMinutos } from "@/lib/horas";
import { statusEfetivo } from "@/lib/statusHora";
import type { EscopoAtividade, EventoCalendario, PeriodoDia, Projeto, Recurso } from "@/types";

/** Mesma janela usada nos botões +M/+T do calendário. */
export const HORARIO_PERIODO: Record<PeriodoDia, { horaInicio: string; horaFim: string }> = {
  manha: { horaInicio: "08:00", horaFim: "12:00" },
  tarde: { horaInicio: "13:00", horaFim: "17:00" },
};

export const PERIODO_LABEL: Record<PeriodoDia, string> = {
  manha: "Manhã",
  tarde: "Tarde",
};

/** Cada turno (manhã ou tarde) comporta 4h de trabalho. */
export const HORAS_POR_TURNO = 4;

export const TURNOS: PeriodoDia[] = ["manha", "tarde"];

/** Um pedaço da alocação de uma atividade dentro de um turno. Atividades longas ocupam turnos seguidos. */
export interface BlocoTurno {
  data: string;
  periodo: PeriodoDia;
  horas: number;
}

/** Uma atividade do cronograma com alocação (folha com recurso e data; sem período assume manhã). */
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
  /** true quando o cronograma não trazia o período e a manhã foi assumida. */
  periodoAssumido: boolean;
  horaInicio: string;
  horaFim: string;
  horasPrevistas: number;
  /** Os turnos que a atividade ocupa (a partir de data/período, em sequência). */
  blocos: BlocoTurno[];
}

export function ehFimDeSemana(iso: string): boolean {
  const dia = new Date(`${iso}T12:00:00`).getDay();
  return dia === 0 || dia === 6;
}

/** O turno seguinte: manhã -> tarde -> manhã do próximo dia útil (fins de semana só se pedido). */
export function proximoTurno(
  data: string,
  periodo: PeriodoDia,
  incluirFimDeSemana = false
): { data: string; periodo: PeriodoDia } {
  if (periodo === "manha") return { data, periodo: "tarde" };
  let proximo = somarDiasIso(data, 1);
  if (!incluirFimDeSemana) while (ehFimDeSemana(proximo)) proximo = somarDiasIso(proximo, 1);
  return { data: proximo, periodo: "manha" };
}

/** Os turnos ocupados por uma atividade de `horas` que começa em data/período: 4h por turno, em sequência. */
export function blocosDaAtividade(
  data: string,
  periodo: PeriodoDia,
  horas: number,
  incluirFimDeSemana = false
): BlocoTurno[] {
  if (horas <= 0) return [{ data, periodo, horas: 0 }];
  const blocos: BlocoTurno[] = [];
  let restante = horas;
  let atual = { data, periodo };
  while (restante > 1e-9 && blocos.length < 400) {
    const h = Math.min(HORAS_POR_TURNO, restante);
    blocos.push({ data: atual.data, periodo: atual.periodo, horas: h });
    restante -= h;
    atual = proximoTurno(atual.data, atual.periodo, incluirFimDeSemana);
  }
  return blocos;
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

/**
 * Turnos ocupados por uma atividade sem período definido: ela entra no dia logo depois do que o mesmo
 * recurso já tinha nesse dia (`horasJaNoDia`), enchendo a manhã (4h) e passando para a tarde e para os
 * dias úteis seguintes. É o caso dos cronogramas que trazem só recurso e data de início.
 */
export function blocosSequenciais(data: string, horasJaNoDia: number, horas: number): BlocoTurno[] {
  if (horas <= 0) {
    const turno: PeriodoDia = horasJaNoDia < HORAS_POR_TURNO ? "manha" : "tarde";
    return [{ data, periodo: turno, horas: 0 }];
  }
  const blocos: BlocoTurno[] = [];
  let restante = horas;
  let dia = data;
  let turnoIndice = Math.min(1, Math.floor(horasJaNoDia / HORAS_POR_TURNO));
  let usadoNoTurno = horasJaNoDia >= HORAS_POR_TURNO * 2 ? 0 : horasJaNoDia % HORAS_POR_TURNO;
  if (horasJaNoDia >= HORAS_POR_TURNO * 2) {
    // o dia já está cheio: começa no dia útil seguinte
    let proximo = somarDiasIso(dia, 1);
    while (ehFimDeSemana(proximo)) proximo = somarDiasIso(proximo, 1);
    dia = proximo;
    turnoIndice = 0;
  }
  while (restante > 1e-9 && blocos.length < 400) {
    const cabe = HORAS_POR_TURNO - usadoNoTurno;
    const h = Math.min(cabe, restante);
    blocos.push({ data: dia, periodo: turnoIndice === 0 ? "manha" : "tarde", horas: h });
    restante -= h;
    usadoNoTurno = 0;
    if (turnoIndice === 0) turnoIndice = 1;
    else {
      let proximo = somarDiasIso(dia, 1);
      while (ehFimDeSemana(proximo)) proximo = somarDiasIso(proximo, 1);
      dia = proximo;
      turnoIndice = 0;
    }
  }
  return blocos;
}

/**
 * Alocação exatamente como o cronograma diz, no período informado (nunca mais que 4h por turno):
 * - início e fim no mesmo dia (ou sem fim): um turno, no dia;
 * - início diferente do fim: a tarefa é DIVIDIDA entre esses dias. Precisa de ceil(horas/4) turnos: o
 *   primeiro fica no dia de início e o último no dia de fim; se precisar de mais, os intermediários
 *   entram nos dias úteis seguintes ao início. Ex.: 6h de 28/10 a 02/11 = 4h em 28/10 + 2h em 02/11.
 * Se a duração é maior do que cabe nos dias do intervalo, NÃO estende (quem errou corrige o cronograma).
 */
export function blocosPorIntervalo(inicio: string, fim: string, periodo: PeriodoDia, horas: number): BlocoTurno[] {
  const total = Math.max(0, horas);
  const turnos = Math.ceil(total / HORAS_POR_TURNO - 1e-9);
  if (fim <= inicio || turnos <= 1) return [{ data: inicio, periodo, horas: Math.min(HORAS_POR_TURNO, total) }];

  const meio = diasDoIntervalo(inicio, fim).filter((d) => d !== inicio && d !== fim && !ehFimDeSemana(d));
  const datas = [inicio, ...meio.slice(0, turnos - 2), fim];
  if (datas.length >= turnos) {
    return datas.map((data, i) => ({
      data,
      periodo,
      horas: i < datas.length - 1 ? HORAS_POR_TURNO : total - HORAS_POR_TURNO * (datas.length - 1),
    }));
  }
  // Mais horas do que dias no intervalo: cada dia leva o que cabe (sem passar de 4h), nada é estendido.
  const porDia = Math.min(HORAS_POR_TURNO, total / datas.length);
  return datas.map((data) => ({ data, periodo, horas: porDia }));
}

/** Todas as alocações previstas de um projeto — só atividades-folha com recurso e data. */
export function alocacoesDoProjeto(projeto: Pick<Projeto, "id" | "codigoProposta" | "escopoAtividades">): AlocacaoAtividade[] {
  const atividades = projeto.escopoAtividades ?? [];
  const folhas = idsFolhas(atividades);
  const alocacoes: AlocacaoAtividade[] = [];
  // Horas que o mesmo recurso já tem, neste projeto, nas tarefas sem período de cada dia.
  const horasSemPeriodoNoDia = new Map<string, number>();
  atividades.forEach((a, i) => {
    if (!folhas.has(a.id) || !a.recursoId || !a.dataInicio) return;
    const horas = horasDaAtividade(a);
    let blocos: BlocoTurno[];
    if (a.periodo && a.dataFim && a.dataFim >= a.dataInicio) {
      blocos = blocosPorIntervalo(a.dataInicio, a.dataFim, a.periodo, horas);
    } else if (a.periodo) {
      blocos = blocosDaAtividade(a.dataInicio, a.periodo, horas);
    } else {
      const chaveDia = `${a.recursoId}|${a.dataInicio}`;
      const ja = horasSemPeriodoNoDia.get(chaveDia) ?? 0;
      blocos = blocosSequenciais(a.dataInicio, ja, horas);
      horasSemPeriodoNoDia.set(chaveDia, ja + horas);
    }
    const periodo: PeriodoDia = a.periodo ?? blocos[0].periodo;
    const { horaInicio, horaFim } = HORARIO_PERIODO[periodo];
    alocacoes.push({
      projetoId: projeto.id,
      projetoNome: projeto.codigoProposta,
      atividadeId: a.id,
      atividadeDescricao: a.descricao,
      grupoDescricao: atividades[indiceGrupoDaAtividade(atividades, i)]?.descricao ?? a.descricao,
      recursoId: a.recursoId,
      data: blocos[0].data,
      periodo,
      periodoAssumido: !a.periodo,
      horaInicio,
      horaFim,
      horasPrevistas: horas,
      blocos,
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

export function chaveTurno(recursoId: string, data: string, periodo: PeriodoDia): string {
  return `${recursoId}|${data}|${periodo}`;
}

export interface CargaTurno {
  horas: number;
  itens: { alocacao: AlocacaoAtividade; horas: number }[];
}

/** Horas previstas em cada (recurso, dia, turno), somando todas as atividades e projetos. */
export function cargaPorTurno(alocacoes: AlocacaoAtividade[]): Map<string, CargaTurno> {
  const cargas = new Map<string, CargaTurno>();
  for (const alocacao of alocacoes) {
    for (const bloco of alocacao.blocos) {
      const chave = chaveTurno(alocacao.recursoId, bloco.data, bloco.periodo);
      const atual = cargas.get(chave) ?? { horas: 0, itens: [] };
      atual.horas += bloco.horas;
      atual.itens.push({ alocacao, horas: bloco.horas });
      cargas.set(chave, atual);
    }
  }
  return cargas;
}

const TOLERANCIA = 0.01;

/**
 * IDs das atividades que estouram a capacidade de um turno (mais de 4h previstas para o mesmo
 * recurso no mesmo dia e turno, mesmo entre projetos diferentes) — a "Sobreposição de agenda".
 */
export function idsAtividadesSobrepostas(alocacoes: AlocacaoAtividade[]): Set<string> {
  const sobrepostas = new Set<string>();
  cargaPorTurno(alocacoes).forEach((carga) => {
    if (carga.horas <= HORAS_POR_TURNO + TOLERANCIA) return;
    carga.itens.forEach((item) => {
      if (item.horas > 0) sobrepostas.add(item.alocacao.atividadeId);
    });
  });
  return sobrepostas;
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

export type StatusTurno = "livre" | "parcial" | "cheio" | "sobreposicao" | "realizado";

export interface CelulaTurno {
  status: StatusTurno;
  horasPrevistas: number;
  horasRealizadas: number;
  itens: { alocacao: AlocacaoAtividade; horas: number }[];
}

export type DiaMapa = Record<PeriodoDia, CelulaTurno>;

/** Turno de um apontamento pela hora de início (antes das 12h30 = manhã). */
export function turnoDaHora(horaInicio: string): PeriodoDia {
  return horaParaMinutos(horaInicio) < 12 * 60 + 30 ? "manha" : "tarde";
}

/** Horas já realizadas (apontamentos aprovados ou aguardando aprovação) em cada (recurso, dia, turno). */
export function horasRealizadasPorTurno(eventos: EventoCalendario[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const ev of eventos) {
    if (ev.retroativo) continue;
    const status = statusEfetivo(ev);
    if (status !== "aprovado" && status !== "aguardando_aprovacao") continue;
    const chave = chaveTurno(ev.recursoId, ev.data, turnoDaHora(ev.horaInicio));
    mapa.set(chave, (mapa.get(chave) ?? 0) + (ev.totalHoras ?? 0));
  }
  return mapa;
}

function statusDoTurno(previstas: number, realizadas: number): StatusTurno {
  if (previstas > HORAS_POR_TURNO + TOLERANCIA) return "sobreposicao";
  if (previstas >= HORAS_POR_TURNO - TOLERANCIA) return "cheio";
  if (previstas > 0) return "parcial";
  return realizadas > 0 ? "realizado" : "livre";
}

/** A matriz recurso x dia x turno do Mapa de Alocação. */
export function montarMapaAlocacao(
  alocacoes: AlocacaoAtividade[],
  recursoIds: string[],
  dias: string[],
  realizadas: Map<string, number> = new Map()
): Map<string, Map<string, DiaMapa>> {
  const cargas = cargaPorTurno(alocacoes);
  const mapa = new Map<string, Map<string, DiaMapa>>();
  for (const recursoId of recursoIds) {
    const porDia = new Map<string, DiaMapa>();
    for (const dia of dias) {
      const celula = (periodo: PeriodoDia): CelulaTurno => {
        const chave = chaveTurno(recursoId, dia, periodo);
        const carga = cargas.get(chave);
        const horasPrevistas = carga?.horas ?? 0;
        const horasRealizadas = realizadas.get(chave) ?? 0;
        return { status: statusDoTurno(horasPrevistas, horasRealizadas), horasPrevistas, horasRealizadas, itens: carga?.itens ?? [] };
      };
      porDia.set(dia, { manha: celula("manha"), tarde: celula("tarde") });
    }
    mapa.set(recursoId, porDia);
  }
  return mapa;
}

/** Horas ocupadas de um turno: o que estiver previsto, ou o que já foi realizado se for maior. */
export function horasOcupadas(celula: CelulaTurno): number {
  return Math.max(celula.horasPrevistas, celula.horasRealizadas);
}

/** % de ocupação de um recurso no período: horas ocupadas / (dias úteis x 8h). */
export function ocupacaoDoRecurso(porDia: Map<string, DiaMapa> | undefined, dias: string[]): number {
  const uteis = dias.filter((d) => !ehFimDeSemana(d));
  if (!porDia || uteis.length === 0) return 0;
  let ocupadas = 0;
  for (const dia of uteis) {
    const d = porDia.get(dia);
    if (d) ocupadas += Math.min(horasOcupadas(d.manha), HORAS_POR_TURNO) + Math.min(horasOcupadas(d.tarde), HORAS_POR_TURNO);
  }
  return ocupadas / (uteis.length * HORAS_POR_TURNO * 2);
}

export interface TurnoLivre {
  data: string;
  periodo: PeriodoDia;
  horasLivres: number;
}

/** Turnos com folga (menos de 4h ocupadas) de um recurso — só dias úteis, salvo se pedido. */
export function turnosLivresDoRecurso(
  porDia: Map<string, DiaMapa> | undefined,
  dias: string[],
  turnos: PeriodoDia[],
  incluirFimDeSemana = false
): TurnoLivre[] {
  const livres: TurnoLivre[] = [];
  if (!porDia) return livres;
  for (const dia of dias) {
    if (!incluirFimDeSemana && ehFimDeSemana(dia)) continue;
    const d = porDia.get(dia);
    if (!d) continue;
    for (const periodo of turnos) {
      const folga = HORAS_POR_TURNO - horasOcupadas(d[periodo]);
      if (folga > TOLERANCIA) livres.push({ data: dia, periodo, horasLivres: folga });
    }
  }
  return livres;
}
