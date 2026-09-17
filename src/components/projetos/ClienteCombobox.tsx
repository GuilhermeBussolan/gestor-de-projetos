"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Cliente } from "@/types";

export function ClienteCombobox({
  clientes,
  value,
  onChange,
  required,
}: {
  clientes: Cliente[];
  value: string;
  onChange: (clienteId: string) => void;
  required?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selecionado = clientes.find((c) => c.id === value);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter((c) =>
      `${nomeExibicaoCliente(c)} ${c.cnpj ?? ""} ${c.codigoCI ?? ""}`.toLowerCase().includes(termo)
    );
  }, [clientes, busca]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex h-10 w-full items-center justify-between rounded-[10px] border border-brand-border bg-white px-3.5 text-left text-[13.5px] text-brand-navy-2 outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
      >
        <span className={selecionado ? "" : "text-brand-faint"}>
          {selecionado ? nomeExibicaoCliente(selecionado) : "Selecione um cliente..."}
        </span>
        <ChevronDown size={15} className="shrink-0 text-brand-faint" />
      </button>
      {required && <input tabIndex={-1} className="sr-only" required value={value} onChange={() => {}} />}

      {aberto && (
        <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-[10px] border border-brand-border bg-white shadow-card-lg">
          <div className="flex items-center gap-2 border-b border-brand-border-soft px-3 py-2">
            <Search size={14} className="shrink-0 text-brand-faint" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CNPJ ou código CI..."
              className="w-full text-[13px] text-brand-navy-2 outline-none placeholder:text-brand-faint"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtrados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setBusca("");
                  setAberto(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[13px] hover:bg-brand-hover"
              >
                <span className="text-brand-navy-2">
                  {nomeExibicaoCliente(c)}
                  {c.cnpj && <span className="text-brand-faint"> — {c.cnpj}</span>}
                </span>
                {c.id === value && <Check size={14} className="shrink-0 text-brand-accent" />}
              </button>
            ))}
            {filtrados.length === 0 && (
              <p className="px-3.5 py-3 text-[13px] text-brand-faint">Nenhum cliente encontrado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
