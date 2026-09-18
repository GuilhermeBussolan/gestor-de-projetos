import type { EmpresaParceira } from "@/types";

export function nomeExibicaoParceira(parceira: Pick<EmpresaParceira, "razaoSocial" | "nomeFantasia"> | undefined): string {
  if (!parceira) return "Parceira";
  return parceira.nomeFantasia?.trim() ? parceira.nomeFantasia : parceira.razaoSocial;
}
