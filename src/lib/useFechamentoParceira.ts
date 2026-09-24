"use client";

import { where } from "firebase/firestore";
import { useCollection } from "@/lib/useCollection";
import type { FechamentoParceiro, Usuario } from "@/types";

/**
 * Os fechamentos já liberados da empresa parceira que o usuário (perfil "responsavel_parceira")
 * representa, e quantos ainda aguardam ciência ou confirmação dele. Só abre a escuta para esse perfil.
 */
export function useFechamentoParceira(usuario: Usuario | null) {
  const ativo = usuario?.perfil === "responsavel_parceira" && !!usuario.parceiraId;
  const { data, loading, erro } = useCollection<FechamentoParceiro>(
    "fechamentoParceiros",
    [where("parceiraId", "==", usuario?.parceiraId ?? ""), where("liberado", "==", true)],
    ativo,
    [ativo, usuario?.parceiraId]
  );
  const itens = ativo ? [...data].sort((a, b) => b.mesAno.localeCompare(a.mesAno)) : [];
  const pendentes = itens.filter((i) => i.confirmacao?.status === "pendente").length;
  return { itens, pendentes, loading, erro };
}
