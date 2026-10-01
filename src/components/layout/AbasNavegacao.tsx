"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Abas de navegação entre as telas de um módulo (Financeiro, Cadastros, Calendário). Ficam "congeladas" no topo
 * enquanto a tela rola, como o congelar painéis do Excel: o fundo cobre o conteúdo que passa por baixo.
 */
export function AbasNavegacao({ abas }: { abas: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="sticky top-0 z-30 -mx-7 -mt-2 mb-3 bg-brand-bg/95 px-7 py-2 backdrop-blur-sm">
      <div className="inline-flex gap-1 rounded-[10px] bg-brand-accent-soft/60 p-[3px]">
        {abas.map((aba) => {
          const ativo = pathname === aba.href;
          return (
            <Link
              key={aba.href}
              href={aba.href}
              className={`rounded-[8px] px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
                ativo ? "bg-white text-brand-navy-2 shadow-[0_2px_6px_rgba(21,40,73,0.12)]" : "text-brand-faint hover:text-brand-muted"
              }`}
            >
              {aba.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
