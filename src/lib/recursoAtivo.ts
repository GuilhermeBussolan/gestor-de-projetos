import type { Recurso } from "@/types";

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

/** Recurso sem o campo é ativo (cadastros antigos). */
export function recursoAtivo(r: Pick<Recurso, "ativo"> | null | undefined): boolean {
  return r?.ativo !== false;
}

/**
 * Recurso inativado continua aceitando apontamentos até a data de inativação (inclusive); depois dela, não.
 * Sem data informada, o inativo não aceita apontamento nenhum.
 */
export function aceitaApontamentoEm(r: Pick<Recurso, "ativo" | "dataInativacao"> | null | undefined, dataIso: string): boolean {
  if (recursoAtivo(r)) return true;
  return !!r?.dataInativacao && dataIso <= r.dataInativacao;
}

export function mensagemRecursoInativo(r: Pick<Recurso, "nomeCompleto" | "dataInativacao">): string {
  return r.dataInativacao
    ? `${r.nomeCompleto} foi inativado em ${dataBR(r.dataInativacao)}: só é possível apontar horas até essa data.`
    : `${r.nomeCompleto} está inativo: não é possível apontar horas para ele.`;
}

/** Rótulo curto para listas e selects. */
export function rotuloInativo(r: Pick<Recurso, "ativo" | "dataInativacao">): string | null {
  if (recursoAtivo(r)) return null;
  return r.dataInativacao ? `inativo desde ${dataBR(r.dataInativacao)}` : "inativo";
}
