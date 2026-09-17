"use client";

import { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function KpiCard({
  label,
  valor,
  nota,
  aberto,
  onToggle,
  children,
}: {
  label: string;
  valor: string;
  nota: string;
  aberto: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`relative w-full overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-card transition-colors ${
          aberto ? "border-brand-accent ring-2 ring-brand-accent/15" : "border-brand-border hover:border-brand-accent/40"
        }`}
      >
        <div
          className="pointer-events-none absolute -top-[60px] -right-10 h-[150px] w-[150px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(47,111,228,.12) 0%, rgba(47,111,228,0) 70%)" }}
        />
        <div className="relative mb-2.5 flex items-center justify-between gap-2 text-[11px] font-bold tracking-[.1em] text-brand-faint uppercase">
          <span>{label}</span>
          <ChevronDown size={13} className={`shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`} />
        </div>
        <div className="relative text-[30px] leading-none font-extrabold tracking-[-0.03em] text-brand-navy-2">
          {valor}
        </div>
        <div className="relative mt-1.5 text-xs text-brand-faint">{nota}</div>
      </button>
      {aberto && (
        <div className="absolute top-full left-0 z-30 mt-2 w-72 max-w-[90vw] rounded-2xl border border-brand-border bg-white p-3.5 shadow-card-lg">
          {children}
        </div>
      )}
    </div>
  );
}

export function PainelVazio() {
  return <p className="px-1 py-2 text-center text-[12px] text-brand-faint">Nada por aqui.</p>;
}
