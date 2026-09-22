"use client";

import { useState } from "react";
import { CalendarClock, Check, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { atualizarPrevisaoFaturamentoMarco } from "@/lib/parcela";
import type { Parcela, Projeto } from "@/types";

function dataBR(iso: string) {
  return iso.split("-").reverse().join("/");
}

/**
 * Campo "Previsão de Faturamento" (1.2) de uma parcela de marco: só existe enquanto a parcela
 * está Aguardando — depois que libera, a data de liberação já conta a história.
 */
export function PrevisaoFaturamentoInline({
  projeto,
  parcela,
  podeEditar,
}: {
  projeto: Projeto;
  parcela: Parcela;
  podeEditar: boolean;
}) {
  const { usuario } = useAuth();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(parcela.dataPrevisaoFaturamento ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  if (parcela.status !== "AGUARDANDO") return null;

  async function salvar() {
    if (!usuario) return;
    setSalvando(true);
    setErro("");
    try {
      await atualizarPrevisaoFaturamentoMarco(projeto, parcela.numero, valor, usuario);
      setEditando(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (editando) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          type="date"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="h-7 rounded-md border border-brand-border px-1.5 text-[11px]"
          autoFocus
        />
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="rounded-md bg-brand-accent p-1 text-white disabled:opacity-50"
          title="Salvar previsão"
        >
          <Check size={12} />
        </button>
        {erro && <span className="text-[10.5px] text-red-600">{erro}</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => podeEditar && setEditando(true)}
      disabled={!podeEditar}
      className={`mt-1.5 flex items-center gap-1 text-[11px] ${
        podeEditar ? "text-brand-accent hover:underline" : "text-brand-faint"
      }`}
    >
      <CalendarClock size={12} />
      {parcela.dataPrevisaoFaturamento ? (
        <>
          Previsão: {dataBR(parcela.dataPrevisaoFaturamento)}
          {podeEditar && <Pencil size={10} />}
        </>
      ) : podeEditar ? (
        "Definir previsão de faturamento"
      ) : (
        "Sem previsão de faturamento"
      )}
    </button>
  );
}
