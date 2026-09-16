"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, KeyRound, LogOut, Users } from "lucide-react";
import type { Usuario } from "@/types";

const PERFIL_LABEL: Record<string, string> = {
  administrador: "Administrador",
  coordenador: "Coordenador",
  consultor: "Consultor",
};

const PERFIL_BADGE: Record<string, string> = {
  administrador: "bg-brand-accent-soft text-[#2456b8]",
  coordenador: "bg-[#fff2de] text-[#a4650d]",
  consultor: "bg-[#e3f5ea] text-[#15754c]",
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
        className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 hover:bg-brand-hover"
        aria-haspopup="menu"
        aria-expanded={aberto}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-navy-2 text-[13px] font-bold text-white">
          {iniciais(usuario.nomeCompleto)}
        </div>
        <ChevronDown
          size={16}
          className={`text-brand-faint transition-transform ${aberto ? "rotate-180" : ""}`}
        />
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card-lg"
        >
          <div className="px-4 py-3.5">
            <p className="truncate text-sm font-bold text-brand-navy-2">{usuario.nomeCompleto}</p>
            <p className="truncate text-xs text-brand-muted">{usuario.email}</p>
            <span
              className={`mt-2.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PERFIL_BADGE[usuario.perfil]}`}
            >
              {PERFIL_LABEL[usuario.perfil]}
            </span>
            {usuario.perfil === "administrador" && (
              <Link
                href="/usuarios"
                onClick={() => setAberto(false)}
                className="mt-3 flex items-center gap-2 text-sm font-medium text-brand-accent hover:underline"
              >
                <Users size={15} />
                Ver usuários
              </Link>
            )}
          </div>
          <div className="border-t border-brand-border-soft py-1">
            <button
              onClick={() => {
                setAberto(false);
                onTrocarSenha();
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-brand-muted hover:bg-brand-hover"
            >
              <KeyRound size={16} />
              Trocar senha
            </button>
            <button
              onClick={() => {
                setAberto(false);
                onSair();
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
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
