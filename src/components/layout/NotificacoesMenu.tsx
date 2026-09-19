"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { where } from "firebase/firestore";
import { Bell, CheckCheck } from "lucide-react";
import { useCollection } from "@/lib/useCollection";
import { TIPO_REGISTRO_CONFIG } from "@/lib/constants";
import { marcarNotificacaoLida, marcarTodasLidas } from "@/lib/notificacoes";
import { formatarDataHoraCurta } from "@/components/timeline/RegistroItem";
import type { Notificacao, Usuario } from "@/types";

/** Sino do topo: tudo em que a pessoa foi marcada, mais recente primeiro. */
export function NotificacoesMenu({
  usuario,
  onAbrirProjeto,
}: {
  usuario: Usuario;
  onAbrirProjeto: (projetoId: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [somenteNaoLidas, setSomenteNaoLidas] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sem orderBy: filtrar por destinatário e ordenar por outro campo exigiria índice composto.
  const { data: recebidas } = useCollection<Notificacao>(
    "notificacoes",
    [where("destinatarioUid", "==", usuario.uid)],
    true,
    [usuario.uid]
  );
  const ordenadas = useMemo(() => [...recebidas].sort((a, b) => b.criadoEm - a.criadoEm), [recebidas]);
  const naoLidas = ordenadas.filter((n) => !n.lida);
  const lista = (somenteNaoLidas ? naoLidas : ordenadas).slice(0, 50);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    function aoPressionarEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoPressionarEsc);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoPressionarEsc);
    };
  }, []);

  function abrir(n: Notificacao) {
    setAberto(false);
    if (!n.lida) marcarNotificacaoLida(n.id).catch((err) => console.error("Erro ao marcar como lida:", err));
    onAbrirProjeto(n.projetoId);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        title="Notificações"
        aria-label={`Notificações${naoLidas.length ? ` (${naoLidas.length} não lidas)` : ""}`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-brand-faint hover:bg-brand-hover hover:text-brand-accent"
      >
        <Bell size={20} />
        {naoLidas.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {naoLidas.length > 9 ? "9+" : naoLidas.length}
          </span>
        )}
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[380px] max-w-[92vw] overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-brand-border-soft px-4 py-3">
            <p className="text-sm font-bold text-brand-navy-2">Notificações</p>
            {naoLidas.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  marcarTodasLidas(naoLidas.map((n) => n.id)).catch((err) =>
                    console.error("Erro ao marcar todas como lidas:", err)
                  )
                }
                className="flex items-center gap-1 text-[12px] font-semibold text-brand-accent hover:underline"
              >
                <CheckCheck size={14} /> Marcar todas como lidas
              </button>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 border-b border-brand-border-soft px-4 py-2 text-[12px] text-brand-muted">
            <input
              type="checkbox"
              checked={somenteNaoLidas}
              onChange={(e) => setSomenteNaoLidas(e.target.checked)}
            />
            Mostrar só as não lidas
          </label>

          <div className="max-h-[420px] overflow-y-auto">
            {lista.map((n) => {
              const cfg = TIPO_REGISTRO_CONFIG[n.tipo];
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => abrir(n)}
                  className={`flex w-full gap-3 border-b border-brand-border-soft px-4 py-3 text-left last:border-b-0 hover:bg-brand-hover ${
                    n.lida ? "" : "bg-brand-accent-soft/40"
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.lida ? "bg-transparent" : "bg-brand-accent"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-brand-navy-2">
                      <strong>{n.autorNome}</strong>
                      {n.tipo === "ciencia" ? "deu ciência em" : "marcou você em"}
                      <strong className="truncate">{n.projetoNome || "um projeto"}</strong>
                      {n.tipo !== "atualizacao" && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold"
                          style={{ backgroundColor: cfg.bg, color: cfg.text }}
                        >
                          {cfg.label}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[12px] text-brand-muted">{n.texto}</span>
                    <span className="mt-1 block text-[11px] text-brand-faint">{formatarDataHoraCurta(n.criadoEm)}</span>
                  </span>
                </button>
              );
            })}
            {lista.length === 0 && (
              <p className="px-4 py-8 text-center text-[13px] text-brand-faint">
                {somenteNaoLidas && ordenadas.length > 0
                  ? "Nenhuma notificação não lida."
                  : "Você ainda não foi marcado em nenhum projeto."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
