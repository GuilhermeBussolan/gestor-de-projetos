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

export function formatarDataCurta(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
