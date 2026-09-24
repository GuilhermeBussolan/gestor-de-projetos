"use client";

import { where } from "firebase/firestore";
import { useCollection } from "@/lib/useCollection";
import type { ItemFechamento, Usuario } from "@/types";

/**
 * Os fechamentos já liberados que dizem respeito ao consultor (terceiro) logado, e quantos ainda
 * aguardam a conferência dele. Só abre a escuta para consultor com recurso vinculado.
 */
export function useMeuFechamento(usuario: Usuario | null) {
  const ativo = usuario?.perfil === "consultor" && !!usuario.recursoId;
  const { data, loading, erro } = useCollection<ItemFechamento>(
    "fechamentoItens",
    [where("recursoId", "==", usuario?.recursoId ?? ""), where("liberado", "==", true)],
    ativo,
    [ativo, usuario?.recursoId]
  );
  const itens = ativo ? [...data].sort((a, b) => b.mesAno.localeCompare(a.mesAno)) : [];
  const pendentes = itens.filter((i) => i.tipoBox === "terceiro" && i.confirmacao?.status === "pendente").length;
  return { itens, pendentes, loading, erro };
}
