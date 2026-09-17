"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import type { Escopo } from "@/types";

export function EscopoSelector({
  escopos,
  escopoIdAtual,
  escopoNomeAtual,
  onSelecionar,
  onRemover,
  persisteAoConfirmar = true,
}: {
  escopos: Escopo[];
  escopoIdAtual: string | null;
  escopoNomeAtual: string | null;
  onSelecionar: (escopo: Escopo) => void | Promise<void>;
  onRemover: () => void | Promise<void>;
  /** true (padrão): a inclusão já grava no projeto imediatamente. false: só fica pendente até o formulário ser salvo. */
  persisteAoConfirmar?: boolean;
}) {
  const [pendente, setPendente] = useState("");
  const [confirmandoInclusao, setConfirmandoInclusao] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<"incluido" | "removido" | null>(null);
  const [erro, setErro] = useState("");

  const escopoPendente = escopos.find((e) => e.id === pendente);

  async function confirmarInclusao() {
    if (!escopoPendente) return;
    setSalvando(true);
    setErro("");
    try {
      await onSelecionar(escopoPendente);
      setPendente("");
      setConfirmandoInclusao(false);
      setSucesso("incluido");
      setTimeout(() => setSucesso(null), 4000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível incluir o escopo.");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarRemocao() {
    setSalvando(true);
    setErro("");
    try {
      await onRemover();
      setConfirmandoRemocao(false);
      setSucesso("removido");
      setTimeout(() => setSucesso(null), 4000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível remover o escopo.");
    } finally {
      setSalvando(false);
    }
  }

  if (escopoIdAtual) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-md border border-brand-border bg-brand-hover px-3.5 py-2.5 text-sm">
          <span className="text-brand-navy-2">
            Escopo vinculado: <strong>{escopoNomeAtual}</strong>
          </span>
          {!confirmandoRemocao && (
            <button
              type="button"
              onClick={() => setConfirmandoRemocao(true)}
              className="text-[12.5px] font-semibold text-red-600 hover:underline"
            >
              Remover
            </button>
          )}
        </div>
        {confirmandoRemocao && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-[#f3c9c2] bg-[#fdeceb] px-3.5 py-2.5 text-[12.5px] text-[#b5392a]">
            <span>Remover o vínculo com este escopo?</span>
            <div className="flex shrink-0 gap-3">
              <button
                type="button"
                onClick={() => setConfirmandoRemocao(false)}
                className="font-semibold hover:underline"
              >
                Cancelar
              </button>
              <button type="button" onClick={confirmarRemocao} disabled={salvando} className="font-bold hover:underline">
                {salvando ? "Removendo..." : "Confirmar remoção"}
              </button>
            </div>
          </div>
        )}
        {sucesso === "removido" && (
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#15754c]">
            <CheckCircle2 size={14} /> Escopo removido do projeto.
          </p>
        )}
        {erro && <p className="text-[12.5px] font-semibold text-red-600">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select
          value={pendente}
          onChange={(e) => {
            setPendente(e.target.value);
            setConfirmandoInclusao(false);
          }}
          className="flex-1"
        >
          <option value="">Nenhum escopo</option>
          {escopos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome} ({e.atividades.length} atividades)
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="secondary"
          disabled={!pendente}
          onClick={() => setConfirmandoInclusao(true)}
        >
          Incluir escopo
        </Button>
      </div>

      {confirmandoInclusao && escopoPendente && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-brand-accent/30 bg-brand-accent-soft/40 px-3.5 py-2.5 text-[12.5px] text-brand-navy-2">
          <span>
            Realmente deseja incluir o escopo <strong>{escopoPendente.nome}</strong> (
            {escopoPendente.atividades.length} atividades) neste projeto?
          </span>
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={() => setConfirmandoInclusao(false)}
              className="font-semibold hover:underline"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarInclusao}
              disabled={salvando}
              className="font-bold text-brand-accent hover:underline"
            >
              {salvando ? "Salvando..." : "Confirmar inclusão"}
            </button>
          </div>
        </div>
      )}

      {sucesso === "incluido" && (
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#15754c]">
          <CheckCircle2 size={14} />
          {persisteAoConfirmar
            ? "Escopo incluído no projeto."
            : "Escopo será incluído quando o projeto for salvo."}
        </p>
      )}

      {erro && <p className="text-[12.5px] font-semibold text-red-600">{erro}</p>}
    </div>
  );
}
