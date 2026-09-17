import type { EventoCalendario, Perfil, Recurso, StatusHora } from "@/types";

/**
 * Normaliza o status de um evento, incluindo dados antigos gravados antes do
 * fluxo de aprovação existir:
 * - avulso sem status (era considerado "real" direto) -> aprovado
 * - recorrência com os valores antigos "pendente"/"realizada"/"cancelada"
 */
export function statusEfetivo(evento: Pick<EventoCalendario, "status" | "origem">): StatusHora {
  const s = evento.status as string | null | undefined;
  if (!s) return evento.origem === "avulso" ? "aprovado" : "previsto";
  if (s === "pendente") return "previsto";
  if (s === "realizada") return "aprovado";
  if (s === "cancelada") return "cancelado";
  return s as StatusHora;
}

/**
 * Decide o status ao criar um lançamento (avulso ou ocorrência de agenda
 * fixa): coordenadores se auto-aprovam, e quem já é admin/coordenador tem os
 * lançamentos que registra aprovados direto — a aprovação existe para
 * revisar horas que o próprio consultor se autodeclara, então só entra
 * nesse fluxo quando é o próprio consultor lançando/confirmando.
 */
export function statusNaCriacao(recurso: Recurso | undefined, perfilAtor: Perfil): StatusHora {
  if (recurso?.tipo === "coordenador") return "aprovado";
  if (perfilAtor === "administrador" || perfilAtor === "coordenador") return "aprovado";
  return "previsto";
}

/**
 * Decide o status ao CONFIRMAR um lançamento como realizado (seja a partir
 * de "previsto" ou reenviando um "rejeitado" ajustado): coordenadores e
 * quem já é admin/coordenador se auto-aprovam; um consultor confirmando o
 * próprio lançamento cai na fila de aprovação.
 */
export function statusAoConfirmar(recurso: Recurso | undefined, perfilAtor: Perfil): StatusHora {
  if (recurso?.tipo === "coordenador") return "aprovado";
  if (perfilAtor === "administrador" || perfilAtor === "coordenador") return "aprovado";
  return "aguardando_aprovacao";
}

export const STATUS_HORA_CONFIG: Record<StatusHora, { label: string; bg: string; text: string }> = {
  previsto: { label: "Previsto", bg: "#eef1f8", text: "#6a7594" },
  aguardando_aprovacao: { label: "Aguardando aprovação", bg: "#fff2de", text: "#a4650d" },
  aprovado: { label: "Aprovado", bg: "#e3f5ea", text: "#15754c" },
  rejeitado: { label: "Rejeitado", bg: "#fdeceb", text: "#b5392a" },
  cancelado: { label: "Cancelado", bg: "#eef1f8", text: "#6a7594" },
};
