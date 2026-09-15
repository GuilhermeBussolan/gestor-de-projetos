"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import type { Usuario } from "@/types";

const PERFIL_LABEL: Record<string, string> = {
  administrador: "Administrador",
  coordenador: "Coordenador",
  consultor: "Consultor",
};

const PERFIL_BADGE: Record<string, string> = {
  administrador: "bg-sky-100 text-sky-700",
  coordenador: "bg-violet-100 text-violet-700",
  consultor: "bg-emerald-100 text-emerald-700",
};

function iniciais(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

export function AccountMenu({
  usuario,
  onTrocarSenha,
  onSair,
}: {
  usuario: Usuario;
  onTrocarSenha: () => void;
  onSair: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-slate-100"
        aria-haspopup="menu"
        aria-expanded={aberto}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-white">
          {iniciais(usuario.nomeCompleto)}
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
        >
          <div className="px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">{usuario.nomeCompleto}</p>
            <p className="truncate text-xs text-slate-500">{usuario.email}</p>
            <span
              className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PERFIL_BADGE[usuario.perfil]}`}
            >
              {PERFIL_LABEL[usuario.perfil]}
            </span>
          </div>
          <div className="border-t border-slate-100 py-1">
            <button
              onClick={() => {
                setAberto(false);
                onTrocarSenha();
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
            >
              <KeyRound size={16} />
              Trocar senha
            </button>
            <button
              onClick={() => {
                setAberto(false);
                onSair();
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
