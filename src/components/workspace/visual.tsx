import { AlertCircle, Archive, Bell, CalendarDays, Circle, CircleCheck, CircleDot, Flag, type LucideIcon } from "lucide-react";
import { diasAte, estaFinalizada, PRIORIDADE_ANOTACAO } from "@/lib/workspace";
import type { Anotacao, StatusAnotacao } from "@/types";

/** Ícone de cada status (mesmas cores de STATUS_ANOTACAO). */
export const ICONE_STATUS: Record<StatusAnotacao, LucideIcon> = {
  a_fazer: Circle,
  em_andamento: CircleDot,
  concluido: CircleCheck,
  arquivado: Archive,
};

const dataCurta = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

/** Prazo em linguagem simples: "Atrasada", "Hoje", "Amanhã" ou a data — com o sininho quando há lembrete. */
export function ChipPrazo({ a, hojeIso }: { a: Anotacao; hojeIso: string }) {
  if (!a.dataLimite) return null;
  const dias = diasAte(a.dataLimite, hojeIso);
  const finalizada = estaFinalizada(a);
  const lembrete = !finalizada && ((a.lembretesDiasAntes?.length ?? 0) > 0 || a.lembreteDiasAntes != null);
  const [texto, classe, Icone] = finalizada
    ? [dataCurta(a.dataLimite), "bg-brand-hover text-brand-faint", CalendarDays]
    : dias < 0
      ? [`Atrasada · ${dataCurta(a.dataLimite)}`, "bg-[#fdeceb] text-[#b5392a]", AlertCircle]
      : dias === 0
        ? ["Hoje", "bg-[#fff2de] text-[#a4650d]", CalendarDays]
        : dias === 1
          ? ["Amanhã", "bg-brand-accent-soft text-brand-accent", CalendarDays]
          : [dataCurta(a.dataLimite), "bg-brand-hover text-brand-muted", CalendarDays];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${classe}`}
      title={`Prazo: ${a.dataLimite.split("-").reverse().join("/")}${lembrete ? " · com lembrete nas notificações" : ""}`}
    >
      <Icone size={11} />
      {texto}
      {lembrete && <Bell size={10} />}
    </span>
  );
}

/** Prioridade só aparece quando foge do normal (bandeira vermelha = alta, cinza = baixa). */
export function ChipPrioridade({ a, sempre = false }: { a: Anotacao; sempre?: boolean }) {
  if (a.prioridade === "normal" && !sempre) return null;
  const cfg = PRIORIDADE_ANOTACAO[a.prioridade];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.cor }}
      title={`Prioridade ${cfg.label.toLowerCase()}`}
    >
      <Flag size={10} />
      {cfg.label}
    </span>
  );
}
