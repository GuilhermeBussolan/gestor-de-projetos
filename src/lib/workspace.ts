import { fimDoBloco, nivelAtividade, temFilhos } from "@/lib/escopo";
import { semAcento } from "@/lib/mencoes";
import type { Anotacao, Perfil, PrioridadeAnotacao, Projeto, StatusAnotacao } from "@/types";

/**
 * Quem tem o Meu Workspace: todos os usuários da NG (o responsável da parceira, externo, não).
 * Cada pessoa só enxerga as próprias anotações — as regras do Firestore garantem isso.
 */
export const PERFIS_WORKSPACE: Perfil[] = ["administrador", "coordenador", "consultor", "financeiro"];

/**
 * Workspace pessoal do consultor (anotações privadas organizadas num Kanban). Regra-mãe: é uma camada 100% pessoal —
 * o vínculo com projeto/fase/atividade é só contexto e NUNCA altera o projeto, a atividade, o cronograma ou gera
 * apontamento. Esta parte é só cálculo (sem gravar nada).
 */

export const STATUS_ANOTACAO: Record<StatusAnotacao, { label: string; cor: string; bg: string }> = {
  a_fazer: { label: "A fazer", cor: "#6a7594", bg: "#eef1f8" },
  em_andamento: { label: "Em andamento", cor: "#2456b8", bg: "#e8efff" },
  concluido: { label: "Concluído", cor: "#15754c", bg: "#e3f5ea" },
  arquivado: { label: "Arquivado", cor: "#8b94ad", bg: "#f1f2f6" },
};
/** Colunas do Kanban principal (arquivadas ficam em "Ver arquivadas"). */
export const COLUNAS_KANBAN: StatusAnotacao[] = ["a_fazer", "em_andamento", "concluido"];

export const PRIORIDADE_ANOTACAO: Record<PrioridadeAnotacao, { label: string; cor: string; bg: string }> = {
  baixa: { label: "Baixa", cor: "#6a7594", bg: "#eef1f8" },
  normal: { label: "Normal", cor: "#a4650d", bg: "#fff2de" },
  alta: { label: "Alta", cor: "#b5392a", bg: "#fdeceb" },
};
export const PRIORIDADES: PrioridadeAnotacao[] = ["baixa", "normal", "alta"];

export interface OpcaoEscopo {
  id: string;
  descricao: string;
  /** Para atividades: a fase (raiz) a que pertencem. */
  faseId?: string;
  /** Para atividades: "Fase › Grupo" (contexto para escolher). */
  caminho?: string;
}

/** Fases do projeto: as atividades-raiz (nível 0) do escopo/cronograma. */
export function fasesDoProjeto(projeto: Pick<Projeto, "escopoAtividades"> | undefined): OpcaoEscopo[] {
  const ativs = projeto?.escopoAtividades ?? [];
  return ativs.filter((a) => nivelAtividade(a) === 0).map((a) => ({ id: a.id, descricao: a.descricao }));
}

/**
 * Atividades (folhas) do contexto: as da fase escolhida ou, sem fase, todas as do projeto. Cada uma vem com a fase
 * a que pertence e o caminho, para a tela preencher a fase ao escolher a atividade.
 */
export function atividadesDoContexto(projeto: Pick<Projeto, "escopoAtividades"> | undefined, faseId?: string | null): OpcaoEscopo[] {
  const ativs = projeto?.escopoAtividades ?? [];
  const resultado: OpcaoEscopo[] = [];
  const pilha: string[] = [];
  let faseAtual: string | undefined;
  ativs.forEach((a, i) => {
    const nivel = nivelAtividade(a);
    pilha.length = nivel;
    if (nivel === 0) faseAtual = a.id;
    if (!temFilhos(ativs, i) && nivel > 0 && (!faseId || faseAtual === faseId)) {
      resultado.push({ id: a.id, descricao: a.descricao, faseId: faseAtual, caminho: pilha.join(" › ") });
    }
    pilha.push(a.descricao);
  });
  return resultado;
}

/** A fase (raiz) que contém a atividade, se existir no projeto. */
export function faseDaAtividade(projeto: Pick<Projeto, "escopoAtividades"> | undefined, atividadeId: string): string | null {
  const ativs = projeto?.escopoAtividades ?? [];
  for (let i = 0; i < ativs.length; i++) {
    if (nivelAtividade(ativs[i]) !== 0) continue;
    const fim = fimDoBloco(ativs, i);
    if (ativs.slice(i, fim).some((a) => a.id === atividadeId)) return ativs[i].id;
  }
  return null;
}

const descricaoNoEscopo = (projeto: Projeto | undefined, id: string | null | undefined) =>
  id ? (projeto?.escopoAtividades?.find((a) => a.id === id)?.descricao ?? null) : null;

/** Textos do contexto da anotação (o que foi removido do projeto aparece como "removida"). */
export function contextoDaAnotacao(a: Pick<Anotacao, "projetoId" | "faseId" | "atividadeId">, projetos: Projeto[], nomeProjeto: (p: Projeto) => string) {
  const projeto = a.projetoId ? projetos.find((p) => p.id === a.projetoId) : undefined;
  return {
    projeto: a.projetoId ? (projeto ? nomeProjeto(projeto) : "Projeto removido") : null,
    fase: a.faseId ? (descricaoNoEscopo(projeto, a.faseId) ?? "Fase removida do cronograma") : null,
    atividade: a.atividadeId ? (descricaoNoEscopo(projeto, a.atividadeId) ?? "Atividade removida do cronograma") : null,
  };
}

export const estaFinalizada = (a: Pick<Anotacao, "status">) => a.status === "concluido" || a.status === "arquivado";

/** RN020: passou da data limite e não está concluída nem arquivada. */
export function estaAtrasada(a: Pick<Anotacao, "status" | "dataLimite">, hojeIso: string): boolean {
  return !!a.dataLimite && hojeIso > a.dataLimite && !estaFinalizada(a);
}

/** Normaliza uma tag digitada: sem "#", sem espaços nas pontas, até 30 caracteres. */
export function normalizarTag(texto: string): string {
  return texto.trim().replace(/^#+/, "").replace(/\s+/g, " ").slice(0, 30);
}

export type AtalhoWorkspace = "todas" | "hoje" | "atrasadas" | "a_fazer" | "em_andamento" | "concluido" | "arquivado" | "sem_projeto";

export const ATALHOS: { id: AtalhoWorkspace; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "hoje", label: "Vencem hoje" },
  { id: "atrasadas", label: "Atrasadas" },
  { id: "arquivado", label: "Arquivadas" },
];

export interface FiltrosWorkspace {
  busca: string;
  atalho: AtalhoWorkspace;
  /** "" = todos; "sem" = sem projeto. */
  projetoId: string;
  prioridade: "" | PrioridadeAnotacao;
  tag: string;
  /** Data limite até (YYYY-MM-DD), "" = sem filtro. */
  prazoAte: string;
}

export const FILTROS_VAZIOS: FiltrosWorkspace = { busca: "", atalho: "todas", projetoId: "", prioridade: "", tag: "", prazoAte: "" };

/**
 * Aplica busca, atalho e filtros (sempre sobre as anotações do próprio consultor — a consulta já vem só com as dele).
 * Fora do atalho "Arquivadas", as arquivadas não entram.
 */
export function filtrarAnotacoes(
  anotacoes: Anotacao[],
  filtros: FiltrosWorkspace,
  hojeIso: string,
  textoContexto: (a: Anotacao) => string
): Anotacao[] {
  const termo = semAcento(filtros.busca.trim());
  return anotacoes.filter((a) => {
    if (filtros.atalho === "arquivado" ? a.status !== "arquivado" : a.status === "arquivado") return false;
    if (filtros.atalho === "hoje" && (a.dataLimite !== hojeIso || estaFinalizada(a))) return false;
    if (filtros.atalho === "atrasadas" && !estaAtrasada(a, hojeIso)) return false;
    if ((filtros.atalho === "a_fazer" || filtros.atalho === "em_andamento" || filtros.atalho === "concluido") && a.status !== filtros.atalho) return false;
    if (filtros.atalho === "sem_projeto" && a.projetoId) return false;
    if (filtros.projetoId === "sem" ? !!a.projetoId : filtros.projetoId && a.projetoId !== filtros.projetoId) return false;
    if (filtros.prioridade && a.prioridade !== filtros.prioridade) return false;
    if (filtros.tag && !(a.tags ?? []).includes(filtros.tag)) return false;
    if (filtros.prazoAte && (!a.dataLimite || a.dataLimite > filtros.prazoAte)) return false;
    if (termo) {
      const alvo = semAcento([a.titulo, a.descricao ?? "", textoContexto(a), ...(a.tags ?? []).map((t) => `#${t}`)].join(" "));
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });
}

/** Ordem do Kanban: pela posição salva (menor primeiro). */
export const porOrdem = (a: Pick<Anotacao, "ordem">, b: Pick<Anotacao, "ordem">) => a.ordem - b.ordem;

/**
 * Nova posição ao soltar um card antes de `alvo` (ou no topo da coluna quando `alvo` é null): fica entre o card de
 * cima e o alvo. Sem vizinhos, usa um número menor que todos (vai para o topo).
 */
export function ordemAoSoltar(coluna: Pick<Anotacao, "id" | "ordem">[], idMovido: string, alvoId: string | null): number {
  const lista = coluna.filter((a) => a.id !== idMovido).sort(porOrdem);
  if (lista.length === 0) return 0;
  if (!alvoId) return lista[0].ordem - 1;
  const i = lista.findIndex((a) => a.id === alvoId);
  if (i < 0) return lista[lista.length - 1].ordem + 1;
  if (i === 0) return lista[0].ordem - 1;
  return (lista[i - 1].ordem + lista[i].ordem) / 2;
}

/** Visão "Meus projetos": quantas anotações em cada status por projeto (e "Sem projeto"). */
export function resumoPorProjeto(anotacoes: Anotacao[]): { projetoId: string | null; total: number; porStatus: Record<StatusAnotacao, number> }[] {
  const mapa = new Map<string | null, Record<StatusAnotacao, number>>();
  for (const a of anotacoes) {
    const chave = a.projetoId ?? null;
    const atual = mapa.get(chave) ?? { a_fazer: 0, em_andamento: 0, concluido: 0, arquivado: 0 };
    atual[a.status] += 1;
    mapa.set(chave, atual);
  }
  return [...mapa.entries()].map(([projetoId, porStatus]) => ({
    projetoId,
    porStatus,
    total: Object.values(porStatus).reduce((s, n) => s + n, 0),
  }));
}

/** Lixeira: depois de excluída, a anotação fica este tempo na lixeira (dá para restaurar) e depois é apagada de vez. */
export const DIAS_NA_LIXEIRA = 15;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Dias que faltam para a anotação ser apagada de vez (0 = já venceu). */
export function diasRestantesNaLixeira(deletedAt: number, agora: number): number {
  return Math.max(0, Math.ceil((deletedAt + DIAS_NA_LIXEIRA * DIA_MS - agora) / DIA_MS));
}

export const venceuNaLixeira = (deletedAt: number, agora: number) => agora - deletedAt >= DIAS_NA_LIXEIRA * DIA_MS;

/** Opções prontas de antecedência do lembrete (dias antes da data limite). */
export const OPCOES_LEMBRETE: { dias: number; label: string }[] = [
  { dias: 0, label: "No dia do vencimento" },
  { dias: 1, label: "1 dia antes" },
  { dias: 2, label: "2 dias antes" },
  { dias: 3, label: "3 dias antes" },
  { dias: 7, label: "1 semana antes" },
];
export const MAX_DIAS_LEMBRETE = 60;

export function rotuloAntecedencia(dias: number): string {
  return OPCOES_LEMBRETE.find((o) => o.dias === dias)?.label ?? `${dias} dias antes`;
}

/** Dias entre hoje e a data (positivo = no futuro), pelo calendário (sem horário). */
export function diasAte(dataIso: string, hojeIso: string): number {
  const d = (iso: string) => new Date(`${iso}T12:00:00`).getTime();
  return Math.round((d(dataIso) - d(hojeIso)) / DIA_MS);
}

export interface Lembrete {
  anotacao: Anotacao;
  /** Ex.: "vence amanhã", "vence hoje", "venceu há 2 dias". */
  texto: string;
  vencido: boolean;
  lido: boolean;
  /** Dia em que o lembrete passou a valer (para ordenar). */
  desde: string;
}

/** As antecedências do lembrete (aceita o formato antigo de um número só), sem repetidas, da maior para a menor. */
export function antecedenciasDe(a: Pick<Anotacao, "lembretesDiasAntes" | "lembreteDiasAntes">): number[] {
  const lista = a.lembretesDiasAntes ?? (a.lembreteDiasAntes != null ? [a.lembreteDiasAntes] : []);
  return [...new Set(lista.filter((n) => Number.isFinite(n) && n >= 0))].sort((x, y) => y - x);
}

/** "2 dias antes e No dia do vencimento". */
export function rotuloAntecedencias(dias: number[]): string {
  const rotulos = [...dias].sort((x, y) => y - x).map(rotuloAntecedencia);
  return rotulos.length <= 1 ? (rotulos[0] ?? "") : `${rotulos.slice(0, -1).join(", ")} e ${rotulos[rotulos.length - 1].toLowerCase()}`;
}

/**
 * O lembrete da anotação, se ele já deve aparecer: anotação ativa (não excluída, concluída nem arquivada), com data
 * limite e lembrete ligado, e hoje já chegou à primeira antecedência (a maior). Continua aparecendo depois do
 * vencimento, até a anotação ser concluída. Cada antecedência que chega faz o lembrete voltar como NÃO lido
 * (ex.: lido 2 dias antes, volta a avisar no dia do vencimento).
 */
export function lembreteDaAnotacao(a: Anotacao, hojeIso: string): Lembrete | null {
  const antecedencias = antecedenciasDe(a);
  if (a.deletedAt || estaFinalizada(a) || !a.dataLimite || antecedencias.length === 0) return null;
  const faltam = diasAte(a.dataLimite, hojeIso);
  // Antecedências que já chegaram (hoje >= data limite − antecedência).
  const disparadas = antecedencias.filter((t) => faltam <= t);
  if (disparadas.length === 0) return null;
  const texto =
    faltam > 1 ? `vence em ${faltam} dias` : faltam === 1 ? "vence amanhã" : faltam === 0 ? "vence hoje" : faltam === -1 ? "venceu ontem" : `venceu há ${-faltam} dias`;
  // O último aviso que chegou é o da menor antecedência já disparada; o lembrete está lido se foi lido a partir desse dia.
  const ultimoAviso = new Date(`${a.dataLimite}T00:00:00`);
  ultimoAviso.setDate(ultimoAviso.getDate() - Math.min(...disparadas));
  const primeiroAviso = new Date(`${a.dataLimite}T12:00:00`);
  primeiroAviso.setDate(primeiroAviso.getDate() - Math.max(...disparadas));
  return {
    anotacao: a,
    texto,
    vencido: faltam < 0,
    lido: !!a.lembreteLidoEm && a.lembreteLidoEm >= ultimoAviso.getTime(),
    desde: primeiroAviso.toLocaleDateString("sv-SE"),
  };
}

/** Lembretes que já devem aparecer, os não lidos primeiro e os mais urgentes no topo. */
export function lembretesAtivos(anotacoes: Anotacao[], hojeIso: string): Lembrete[] {
  return anotacoes
    .map((a) => lembreteDaAnotacao(a, hojeIso))
    .filter((l): l is Lembrete => !!l)
    .sort((x, y) => Number(x.lido) - Number(y.lido) || (x.anotacao.dataLimite ?? "").localeCompare(y.anotacao.dataLimite ?? ""));
}
