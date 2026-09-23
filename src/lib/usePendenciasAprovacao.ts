"use client";

import { where } from "firebase/firestore";
import { useCollection } from "@/lib/useCollection";
import type { EventoCalendario, Perfil } from "@/types";

/**
 * Quantos apontamentos estão aguardando aprovação — só quem aprova (administrador e coordenador)
 * enxerga esse número; para os outros perfis nem abre a escuta no Firestore.
 */
export function usePendenciasAprovacao(perfil: Perfil | undefined): number {
  const podeAprovar = perfil === "administrador" || perfil === "coordenador";
  const { data } = useCollection<EventoCalendario>(
    "eventosCalendario",
    [where("status", "==", "aguardando_aprovacao")],
    podeAprovar,
    [podeAprovar]
  );
  return podeAprovar ? data.length : 0;
}
