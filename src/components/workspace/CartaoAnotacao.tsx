"use client";

import { Archive, Check, FolderKanban, Users } from "lucide-react";
import { ChipPrazo, ChipPrioridade } from "@/components/workspace/visual";
import { estaAtrasada } from "@/lib/workspace";
import type { Anotacao } from "@/types";

/** Cartão do quadro: título, projeto e só os chips que importam (prazo, prioridade fora do normal, até 2 tags). */
export function CartaoAnotacao({
  a,
  projeto,
  compartilhamento,
  hojeIso,
  onAbrir,
  onConcluir,
  onArquivar,
  onArrastar,
}: {
  a: Anotacao;
  projeto: string | null;
  /** Tarefa compartilhada: "com Fulano" (sou o dono) ou "de Fulano" (fui marcado). */
  compartilhamento?: string | null;
  hojeIso: string;
  onAbrir: () => void;
  onConcluir?: () => void;
  onArquivar?: () => void;
  onArrastar?: (e: React.DragEvent) => void;
}) {
  const atrasada = estaAtrasada(a, hojeIso);
  const finalizada = a.status === "concluido" || a.status === "arquivado";
  const tags = a.tags ?? [];
  return (
    <div
      draggable={!!onArrastar}
      onDragStart={onArrastar}
      onClick={onAbrir}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onAbrir()}
      className={`group cursor-pointer rounded-xl border bg-white p-3 shadow-[0_2px_8px_rgba(21,40,73,0.06)] transition-shadow hover:shadow-[0_6px_16px_rgba(21,40,73,0.1)] ${
        atrasada ? "border-[#f3b8b0]" : "border-brand-border"
      }`}
    >
      <div className="flex items-start gap-2">
        {onConcluir ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConcluir();
            }}
            title="Marcar como concluída"
            aria-label="Marcar como concluída"
            className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 border-[#cfd5e2] text-transparent transition-colors hover:border-[#15754c] hover:bg-[#e3f5ea] hover:text-[#15754c]"
          >
            <Check size={11} strokeWidth={3} />
          </button>
        ) : (
          a.status === "concluido" && (
            <span className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#15754c] text-white">
              <Check size={11} strokeWidth={3} />
            </span>
          )
        )}
        <p className={`min-w-0 flex-1 text-[13.5px] leading-snug font-bold break-words ${finalizada ? "text-brand-muted" : "text-brand-navy-2"}`}>{a.titulo}</p>
        {onArquivar && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onArquivar();
            }}
            title="Arquivar"
            aria-label="Arquivar"
            className="-mt-0.5 -mr-1 shrink-0 rounded-md p-1 text-brand-faint hover:bg-brand-hover hover:text-brand-navy-2"
          >
            <Archive size={14} />
          </button>
        )}
      </div>
      {projeto && (
        <p className="mt-1.5 flex items-center gap-1 truncate text-[11.5px] text-brand-muted" title={projeto}>
          <FolderKanban size={11} className="shrink-0" />
          <span className="truncate">{projeto}</span>
        </p>
      )}
      {compartilhamento && (
        <p className="mt-1.5 flex items-center gap-1 truncate text-[11.5px] font-semibold text-[#7c3aed]" title={compartilhamento}>
          <Users size={11} className="shrink-0" />
          <span className="truncate">{compartilhamento}</span>
        </p>
      )}
      {(a.dataLimite || a.prioridade !== "normal" || tags.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <ChipPrazo a={a} hojeIso={hojeIso} />
          <ChipPrioridade a={a} />
          {tags.slice(0, 2).map((t) => (
            <span key={t} className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-[11px] font-semibold text-brand-accent">
              #{t}
            </span>
          ))}
          {tags.length > 2 && (
            <span className="text-[11px] text-brand-faint" title={tags.slice(2).map((t) => `#${t}`).join(" ")}>
              +{tags.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
