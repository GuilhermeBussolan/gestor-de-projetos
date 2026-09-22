import type { EscopoAtividade } from "@/types";

export function criarAtividadeId(): string {
  return crypto.randomUUID();
}

// A hierarquia é uma lista plana ordenada + "nivel": os filhos de uma atividade
// são as atividades seguintes com nível maior, até voltar a um nível igual/menor.

export function nivelAtividade(a: EscopoAtividade): number {
  return a.nivel ?? 0;
}

/** Índice (exclusivo) onde termina o bloco da atividade: ela + todos os descendentes. */
export function fimDoBloco(atividades: EscopoAtividade[], indice: number): number {
  const nivel = nivelAtividade(atividades[indice]);
  let fim = indice + 1;
  while (fim < atividades.length && nivelAtividade(atividades[fim]) > nivel) fim++;
  return fim;
}

export function temFilhos(atividades: EscopoAtividade[], indice: number): boolean {
  return fimDoBloco(atividades, indice) > indice + 1;
}

/** Garante que nenhuma atividade pule de nível (máx. nível do anterior + 1; a primeira é raiz). */
export function normalizarNiveis(atividades: EscopoAtividade[]): EscopoAtividade[] {
  return atividades.reduce<EscopoAtividade[]>((acc, a) => {
    const maximo = acc.length === 0 ? 0 : nivelAtividade(acc[acc.length - 1]) + 1;
    const nivel = Math.min(Math.max(nivelAtividade(a), 0), maximo);
    return [...acc, { ...a, nivel }];
  }, []);
}

/** Numeração hierárquica: "1", "1.1", "1.2.1"... */
export function numerarAtividades(atividades: EscopoAtividade[]): string[] {
  const contadores: number[] = [];
  return atividades.map((a) => {
    const nivel = nivelAtividade(a);
    contadores.length = nivel + 1;
    contadores[nivel] = (contadores[nivel] ?? 0) + 1;
    for (let i = 0; i < nivel; i++) contadores[i] = contadores[i] ?? 1;
    return contadores.slice(0, nivel + 1).join(".");
  });
}

/** Índice do irmão anterior (mesmo nível, mesmo pai), ou null. */
export function irmaoAnterior(atividades: EscopoAtividade[], indice: number): number | null {
  const nivel = nivelAtividade(atividades[indice]);
  for (let i = indice - 1; i >= 0; i--) {
    const n = nivelAtividade(atividades[i]);
    if (n === nivel) return i;
    if (n < nivel) return null;
  }
  return null;
}

/** Índice do próximo irmão (mesmo nível, mesmo pai), ou null. */
export function irmaoSeguinte(atividades: EscopoAtividade[], indice: number): number | null {
  const fim = fimDoBloco(atividades, indice);
  if (fim < atividades.length && nivelAtividade(atividades[fim]) === nivelAtividade(atividades[indice])) {
    return fim;
  }
  return null;
}

/** Só as atividades "folha" (sem filhos) — os pais são apenas agrupadores. */
export function idsFolhas(atividades: EscopoAtividade[]): Set<string> {
  const folhas = new Set<string>();
  atividades.forEach((a, i) => {
    if (!temFilhos(atividades, i)) folhas.add(a.id);
  });
  return folhas;
}

export function contarFolhas(
  atividades: EscopoAtividade[],
  concluidas: Set<string>
): { total: number; feitas: number } {
  const folhas = idsFolhas(atividades);
  let feitas = 0;
  folhas.forEach((id) => {
    if (concluidas.has(id)) feitas++;
  });
  return { total: folhas.size, feitas };
}

export type EstadoMarcacao = "marcada" | "parcial" | "vazia";

export function estadoMarcacao(
  atividades: EscopoAtividade[],
  marcadas: Set<string>,
  indice: number
): EstadoMarcacao {
  const fim = fimDoBloco(atividades, indice);
  if (fim === indice + 1) return marcadas.has(atividades[indice].id) ? "marcada" : "vazia";
  const filhos = atividades.slice(indice + 1, fim);
  const qtd = filhos.filter((f) => marcadas.has(f.id)).length;
  if (qtd === 0) return "vazia";
  return qtd === filhos.length ? "marcada" : "parcial";
}

/**
 * Marca/desmarca uma atividade. Marcar um pai marca todo o bloco (filhos e netos);
 * desmarcar um filho desmarca os pais acima dele (pai só fica marcado com todos os filhos).
 */
export function alternarAtividadeMarcada(
  atividades: EscopoAtividade[],
  marcadas: string[],
  id: string
): string[] {
  const indice = atividades.findIndex((a) => a.id === id);
  if (indice < 0) return marcadas;
  const set = new Set(marcadas);
  const bloco = atividades.slice(indice, fimDoBloco(atividades, indice));
  const marcar = estadoMarcacao(atividades, set, indice) !== "marcada";
  bloco.forEach((a) => (marcar ? set.add(a.id) : set.delete(a.id)));

  for (let i = atividades.length - 1; i >= 0; i--) {
    const fim = fimDoBloco(atividades, i);
    if (fim === i + 1) continue;
    const todosFilhos = atividades.slice(i + 1, fim).every((f) => set.has(f.id));
    if (todosFilhos) set.add(atividades[i].id);
    else set.delete(atividades[i].id);
  }
  return Array.from(set);
}

/**
 * Alterna a inclusão de um nó e de todo o bloco abaixo dele (filhos e netos), sem tocar nos
 * ancestrais nem nos irmãos — ao contrário de `alternarAtividadeMarcada` (que também desmarca
 * os pais acima quando um descendente é desmarcado, pensado para o indicador de progresso do
 * apontamento). Aqui, excluir uma tarefa nunca pode fazer a tarefa pai dela sumir da lista.
 */
export function alternarBlocoIncluido(
  atividades: EscopoAtividade[],
  incluidas: string[],
  id: string
): string[] {
  const indice = atividades.findIndex((a) => a.id === id);
  if (indice < 0) return incluidas;
  const set = new Set(incluidas);
  const bloco = atividades.slice(indice, fimDoBloco(atividades, indice));
  const incluir = !set.has(atividades[indice].id);
  bloco.forEach((a) => (incluir ? set.add(a.id) : set.delete(a.id)));
  return Array.from(set);
}

/** Move o bloco (a atividade + descendentes) trocando de lugar com o irmão vizinho anterior/seguinte. */
export function moverBlocoVizinho(
  atividades: EscopoAtividade[],
  indice: number,
  direcao: -1 | 1
): EscopoAtividade[] {
  const fim = fimDoBloco(atividades, indice);
  if (direcao === -1) {
    const anterior = irmaoAnterior(atividades, indice);
    if (anterior === null) return atividades;
    return [
      ...atividades.slice(0, anterior),
      ...atividades.slice(indice, fim),
      ...atividades.slice(anterior, indice),
      ...atividades.slice(fim),
    ];
  }
  const proximo = irmaoSeguinte(atividades, indice);
  if (proximo === null) return atividades;
  const fimProximo = fimDoBloco(atividades, proximo);
  return [
    ...atividades.slice(0, indice),
    ...atividades.slice(proximo, fimProximo),
    ...atividades.slice(indice, fim),
    ...atividades.slice(fimProximo),
  ];
}

/** Índices de todos os irmãos (mesmo nível, mesmo pai) do grupo ao qual `indice` pertence, em ordem. */
export function indicesIrmaos(atividades: EscopoAtividade[], indice: number): number[] {
  let primeiro = indice;
  for (let ant = irmaoAnterior(atividades, primeiro); ant !== null; ant = irmaoAnterior(atividades, primeiro)) {
    primeiro = ant;
  }
  const indices = [primeiro];
  for (let prox = irmaoSeguinte(atividades, primeiro); prox !== null; prox = irmaoSeguinte(atividades, indices[indices.length - 1])) {
    indices.push(prox);
  }
  return indices;
}

/**
 * Arrasta o bloco da atividade `idOrigem` até a posição `posicaoAlvo` entre os próprios irmãos
 * (mesmo nível, mesmo pai) — nunca muda a atividade de hierarquia, só a ordem dela ali dentro.
 * Reaproveita `moverBlocoVizinho` passo a passo, por segurança (mesma lógica já usada nas setas).
 */
export function moverBlocoEntreIrmaos(
  atividades: EscopoAtividade[],
  idOrigem: string,
  posicaoAlvo: number
): EscopoAtividade[] {
  let atual = atividades;
  for (let seguranca = 0; seguranca < atividades.length; seguranca++) {
    const indice = atual.findIndex((a) => a.id === idOrigem);
    if (indice < 0) return atual;
    const irmaos = indicesIrmaos(atual, indice);
    const posAtual = irmaos.indexOf(indice);
    if (posAtual === posicaoAlvo || posAtual === -1) return atual;
    atual = moverBlocoVizinho(atual, indice, posicaoAlvo > posAtual ? 1 : -1);
  }
  return atual;
}

/** true quando as duas atividades são irmãs (mesmo nível, mesmo pai) — a única troca de ordem permitida. */
export function saoIrmas(atividades: EscopoAtividade[], idA: string, idB: string): boolean {
  const indiceA = atividades.findIndex((a) => a.id === idA);
  if (indiceA < 0) return false;
  const indiceB = atividades.findIndex((a) => a.id === idB);
  if (indiceB < 0) return false;
  return indicesIrmaos(atividades, indiceA).includes(indiceB);
}

/** Duração de uma atividade em minutos (0 quando não preenchida). */
export function duracaoEmMinutos(a: Pick<EscopoAtividade, "duracao" | "unidadeDuracao">): number {
  if (!a.duracao) return 0;
  return (a.unidadeDuracao ?? "horas") === "minutos" ? a.duracao : a.duracao * 60;
}

/** "1h30", "45 min", "2h" — para mostrar um total em minutos de forma legível. */
export function formatarMinutos(totalMinutos: number): string {
  if (totalMinutos <= 0) return "—";
  const horas = Math.floor(totalMinutos / 60);
  const minutos = Math.round(totalMinutos - horas * 60);
  if (horas === 0) return `${minutos} min`;
  if (minutos === 0) return `${horas}h`;
  return `${horas}h${minutos}min`;
}

/**
 * Soma (em minutos) de todas as atividades-folha dentro do bloco de `indice` — ela mesma, se for
 * folha, ou os netos/bisnetos que forem folha, se for uma agrupadora. É assim que o valor de um
 * tópico nasce da soma dos subtópicos, que por sua vez nasce da soma dos subsubtópicos.
 */
export function somaDuracaoBloco(atividades: EscopoAtividade[], indice: number): number {
  const folhas = idsFolhas(atividades);
  const fim = fimDoBloco(atividades, indice);
  return atividades
    .slice(indice, fim)
    .reduce((soma, a) => soma + (folhas.has(a.id) ? duracaoEmMinutos(a) : 0), 0);
}

export function formatarDataCurta(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
