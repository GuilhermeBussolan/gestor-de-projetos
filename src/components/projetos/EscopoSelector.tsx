"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Select } from "@/components/ui/Field";
import { EscopoInclusaoModal } from "@/components/projetos/EscopoInclusaoModal";
import type { Escopo, EscopoAtividade, ExclusaoEscopo } from "@/types";

export function EscopoSelector({
  escopos,
  escopoIdAtual,
  escopoNomeAtual,
  exclusoesAtuais,
  onSelecionar,
  onRemover,
  persisteAoConfirmar = true,
}: {
  escopos: Escopo[];
  escopoIdAtual: string | null;
  escopoNomeAtual: string | null;
  /** Exclusões já registradas no projeto — só para mostrar o link "Ver exclusões". */
  exclusoesAtuais?: ExclusaoEscopo[] | null;
  onSelecionar: (
    escopo: Escopo,
    atividades: EscopoAtividade[],
    exclusoes: ExclusaoEscopo[]
  ) => void | Promise<void>;
  onRemover: () => void | Promise<void>;
  /** true (padrão): a inclusão já grava no projeto imediatamente. false: só fica pendente até o formulário ser salvo. */
  persisteAoConfirmar?: boolean;
}) {
  const [pendente, setPendente] = useState("");
  const [incluindo, setIncluindo] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<"incluido" | "removido" | null>(null);
  const [verExclusoes, setVerExclusoes] = useState(false);
  const [erro, setErro] = useState("");

  const escopoPendente = escopos.find((e) => e.id === pendente) ?? null;

  async function confirmarInclusao(
    escopo: Escopo,
    atividades: EscopoAtividade[],
    exclusoes: ExclusaoEscopo[]
  ) {
    await onSelecionar(escopo, atividades, exclusoes);
    setPendente("");
    setSucesso("incluido");
    setTimeout(() => setSucesso(null), 4000);
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
        {!!exclusoesAtuais?.length && (
          <div>
            <button
              type="button"
              onClick={() => setVerExclusoes((v) => !v)}
              className="text-[12px] font-semibold text-brand-accent hover:underline"
            >
              {verExclusoes ? "Ocultar" : "Ver"} exclusões ({exclusoesAtuais.length})
            </button>
            {verExclusoes && (
              <ul className="mt-1.5 space-y-1 rounded-md bg-brand-hover p-2.5 text-[11.5px] text-brand-muted">
                {exclusoesAtuais.map((e, i) => (
                  <li key={i}>
                    <strong className="text-brand-navy-2">{e.descricao}</strong> — excluída por{" "}
                    {e.usuarioNome} em {new Date(e.criadoEm).toLocaleDateString("pt-BR")}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
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
          onChange={(e) => setPendente(e.target.value)}
          className="flex-1"
        >
          <option value="">Nenhum escopo</option>
          {escopos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome} ({e.atividades.length} atividades)
            </option>
          ))}
        </Select>
        <button
          type="button"
          disabled={!pendente}
          onClick={() => setIncluindo(true)}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-brand-border bg-white px-4 text-[13.5px] font-semibold text-brand-navy-2 transition-colors hover:border-brand-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Incluir escopo
        </button>
      </div>

      <EscopoInclusaoModal
        escopo={incluindo ? escopoPendente : null}
        onClose={() => setIncluindo(false)}
        onConfirmar={(atividades, exclusoes) =>
          escopoPendente ? confirmarInclusao(escopoPendente, atividades, exclusoes) : undefined
        }
      />

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
