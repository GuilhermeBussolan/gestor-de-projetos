import type { ContatoProjeto, Mencionado, PessoaDiretorio, Projeto } from "@/types";

export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Trecho "@algo" logo antes do cursor (só no início do texto ou depois de espaço/quebra de linha). */
export function detectarToken(texto: string, cursor: number): { inicio: number; termo: string } | null {
  const antes = texto.slice(0, cursor);
  const m = /(^|\s)@([^\s@]{0,30})$/.exec(antes);
  if (!m) return null;
  return { inicio: antes.length - m[2].length - 1, termo: m[2] };
}

/** Pessoas cujo nome tem alguma palavra começando com o termo digitado. */
export function filtrarPessoas(pessoas: PessoaDiretorio[], termo: string): PessoaDiretorio[] {
  const t = semAcento(termo);
  return pessoas
    .filter((p) => {
      if (!t) return true;
      return semAcento(p.nomeCompleto)
        .split(/\s+/)
        .some((palavra) => palavra.startsWith(t));
    })
    .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, "pt-BR"));
}

export function inserirMencao(
  texto: string,
  token: { inicio: number },
  cursor: number,
  nome: string
): { texto: string; cursor: number } {
  const inserido = `@${nome} `;
  return {
    texto: texto.slice(0, token.inicio) + inserido + texto.slice(cursor),
    cursor: token.inicio + inserido.length,
  };
}

/** Só vale quem ainda está escrito no texto (a pessoa pode ter apagado a marcação). */
export function mencionadosPresentes(texto: string, selecionados: Mencionado[]): Mencionado[] {
  return selecionados.filter((p) => texto.includes(`@${p.nome}`));
}

function escaparRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Quebra o texto em pedaços para destacar as marcações. */
export function partirComMencoes(texto: string, nomes: string[]): { texto: string; mencao: boolean }[] {
  if (nomes.length === 0) return [{ texto, mencao: false }];
  const alternativas = [...nomes]
    .sort((a, b) => b.length - a.length)
    .map((n) => escaparRegex(`@${n}`))
    .join("|");
  return texto
    .split(new RegExp(`(${alternativas})`))
    .filter((p) => p !== "")
    .map((p) => ({ texto: p, mencao: nomes.some((n) => p === `@${n}`) }));
}

/** registroId -> (uid de quem deu ciência -> quando). */
export function cienciasPorRegistro(registros: ContatoProjeto[]): Map<string, Map<string, number>> {
  const mapa = new Map<string, Map<string, number>>();
  for (const r of registros) {
    if (r.tipo !== "ciencia" || !r.respondeAId) continue;
    const porPessoa = mapa.get(r.respondeAId) ?? new Map<string, number>();
    if (!porPessoa.has(r.usuarioId)) porPessoa.set(r.usuarioId, r.criadoEm);
    mapa.set(r.respondeAId, porPessoa);
  }
  return mapa;
}

/** Quem pode ser marcado num projeto: administradores e o time alocado (coordenador e consultores). */
export function pessoasMencionaveis(
  diretorio: PessoaDiretorio[],
  projeto: Pick<Projeto, "coordenadorId" | "consultorIds">,
  meuUid: string
): PessoaDiretorio[] {
  const recursosDoProjeto = new Set<string>(
    [projeto.coordenadorId, ...(projeto.consultorIds ?? [])].filter((id): id is string => !!id)
  );
  return diretorio.filter(
    (p) =>
      p.id !== meuUid &&
      (p.perfil === "administrador" || (!!p.recursoId && recursosDoProjeto.has(p.recursoId)))
  );
}
