"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/calendario", label: "Calendário" },
  { href: "/calendario/mapa-alocacao", label: "Mapa de Alocação" },
];

export function CalendarioTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-5 inline-flex gap-1 rounded-[10px] bg-brand-accent-soft/60 p-[3px]">
      {ABAS.map((aba) => {
        const ativo = pathname === aba.href;
        return (
          <Link
            key={aba.href}
            href={aba.href}
            className={`rounded-[8px] px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
              ativo
                ? "bg-white text-brand-navy-2 shadow-[0_2px_6px_rgba(21,40,73,0.12)]"
                : "text-brand-faint hover:text-brand-muted"
            }`}
          >
            {aba.label}
          </Link>
        );
      })}
    </div>
  );
}
