"use client";

import { where } from "firebase/firestore";
import { useCollection } from "@/lib/useCollection";
import type { BloqueioAgenda, Usuario } from "@/types";

/**
 * Bloqueios de agenda que o usuário pode ver: o consultor só os da própria agenda (a regra do Firestore exige o filtro
 * por recurso); administrador e coordenador veem todos. Com `recursoId`, busca só os daquele recurso.
 */
export function useBloqueiosAgenda(usuario: Usuario | null, recursoId?: string) {
  const souConsultor = usuario?.perfil === "consultor";
  const filtro = recursoId ?? (souConsultor ? (usuario?.recursoId ?? "") : "");
  const ativo = !!usuario && (!souConsultor || !!usuario.recursoId) && (recursoId === undefined || !!recursoId);
  const { data, loading } = useCollection<BloqueioAgenda>(
    "bloqueiosAgenda",
    filtro ? [where("recursoId", "==", filtro)] : [],
    ativo,
    [ativo, filtro]
  );
  return { bloqueios: ativo ? data : [], loading };
}
