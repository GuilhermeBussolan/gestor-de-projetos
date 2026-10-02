"use client";

import { where } from "firebase/firestore";
import { useCollection } from "@/lib/useCollection";
import { lembretesAtivos, PERFIS_WORKSPACE } from "@/lib/workspace";
import type { Anotacao, Notificacao, Usuario } from "@/types";

/**
 * Pendências do Workspace que estão no sino e ainda não foram lidas: os lembretes das próprias anotações e, nas tarefas
 * compartilhadas (admin/financeiro), os avisos de marcação, atualização e mudança de status. Alimenta a bolinha do menu.
 */
export function usePendenciasWorkspace(usuario: Usuario | null): number {
  const ativo = !!usuario && PERFIS_WORKSPACE.includes(usuario.perfil);
  const uid = usuario?.uid ?? "";
  const { data: anotacoes } = useCollection<Anotacao>("anotacoes", [where("usuarioId", "==", uid)], ativo, [uid, ativo]);
  const { data: notificacoes } = useCollection<Notificacao>("notificacoes", [where("destinatarioUid", "==", uid)], ativo, [uid, ativo]);
  if (!ativo) return 0;
  const hojeIso = new Date().toLocaleDateString("sv-SE");
  const lembretes = lembretesAtivos(anotacoes, hojeIso).filter((l) => !l.lido).length;
  const avisos = notificacoes.filter((n) => n.origem === "workspace" && !n.lida).length;
  return lembretes + avisos;
}
