"use client";

import { where } from "firebase/firestore";
import { useCollection } from "@/lib/useCollection";
import type { ItemFechamento, Usuario } from "@/types";

/**
 * Os fechamentos já liberados do próprio consultor (terceiro), para ele conferir e confirmar as horas com o login dele,
 * e quantos ainda esperam a resposta dele. Só abre a escuta para o perfil consultor com recurso vinculado; consultor
 * interno nunca tem item de fechamento, então a lista dele fica sempre vazia.
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
  const pendentes = itens.filter((i) => i.confirmacao.status === "pendente").length;
  return { itens, pendentes, loading, erro };
}
