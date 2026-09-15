import type { Cliente } from "@/types";

export function nomeExibicaoCliente(cliente: Pick<Cliente, "nome" | "nomeFantasia"> | undefined): string {
  if (!cliente) return "Cliente";
  return cliente.nomeFantasia?.trim() ? cliente.nomeFantasia : cliente.nome;
}
