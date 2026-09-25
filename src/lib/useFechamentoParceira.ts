"use client";

import { where } from "firebase/firestore";
import { useCollection } from "@/lib/useCollection";
import { situacaoDaParceira } from "@/lib/fechamentoNf";
import type { FechamentoParceiro, Usuario } from "@/types";

/**
 * Os fechamentos já liberados da empresa parceira que o usuário (perfil "responsavel_parceira")
 * representa, e quantos ainda aguardam uma ação dele (ciência, confirmação ou nota fiscal). Só abre a escuta para esse perfil.
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
  // Pede uma ação dele: enviar (ou reenviar) a nota fiscal. Nos fechamentos antigos, também a ciência e a confirmação dos valores
  // (no fluxo atual quem confirma é cada consultor, e o responsável só acompanha).
  const pendentes = itens.filter((i) => {
    const s = situacaoDaParceira(i);
    if (s === "aguardando_nf" || s === "nf_rejeitada") return true;
    return !i.statusConsultores && (s === "aguardando_ciencia" || s === "aguardando_confirmacao");
  }).length;
  return { itens, pendentes, loading, erro };
}
