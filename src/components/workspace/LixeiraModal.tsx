"use client";

import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DIAS_NA_LIXEIRA, diasRestantesNaLixeira } from "@/lib/workspace";
import { excluirDefinitivamente, restaurarDaLixeira } from "@/lib/workspaceDb";
import type { Anotacao } from "@/types";

const dataHora = (ms: number) => new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * Lixeira do Workspace: as anotações excluídas ficam aqui por DIAS_NA_LIXEIRA dias. Dá para restaurar (volta como
 * estava) ou apagar de vez; passado o prazo, são apagadas sozinhas.
 */
export function LixeiraModal({
  itens,
  contextoProjeto,
  onClose,
}: {
  itens: Anotacao[];
  contextoProjeto: (a: Anotacao) => string | null;
  onClose: () => void;
}) {
  const [processando, setProcessando] = useState<string | null>(null);
  const [confirmandoTudo, setConfirmandoTudo] = useState(false);
  const [erro, setErro] = useState("");
  const [agora] = useState(() => Date.now());
  const ordenados = [...itens].sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));

  async function executar(id: string, fn: () => Promise<void>) {
    setProcessando(id);
    setErro("");
    try {
      await fn();
    } catch (err) {
      console.error("Erro na lixeira:", err);
      setErro("Não foi possível concluir. Confira se as regras do Firestore foram publicadas e tente de novo.");
    } finally {
      setProcessando(null);
    }
  }

  async function esvaziar() {
    setConfirmandoTudo(false);
    await executar("tudo", async () => {
      for (const a of ordenados) await excluirDefinitivamente(a);
    });
  }

  return (
    <Modal open onClose={onClose} title="Lixeira" wide>
      <p className="mb-3 text-[13px] text-brand-muted">
        As anotações excluídas ficam aqui por <strong>{DIAS_NA_LIXEIRA} dias</strong> e depois são apagadas de vez. Até lá, você pode restaurá-las.
      </p>
      {erro && <p className="mb-3 rounded-md bg-[#fdeceb] p-3 text-[13px] text-[#b5392a]">{erro}</p>}
      <div className="divide-y divide-brand-border-soft overflow-hidden rounded-xl border border-brand-border">
        {ordenados.map((a) => {
          const dias = diasRestantesNaLixeira(a.deletedAt ?? agora, agora);
          const projeto = contextoProjeto(a);
          return (
            <div key={a.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-brand-navy-2">{a.titulo}</p>
                <p className="text-[11.5px] text-brand-faint">
                  {projeto ? `${projeto} · ` : ""}excluída em {a.deletedAt ? dataHora(a.deletedAt) : "—"} ·{" "}
                  <span className={dias <= 3 ? "font-semibold text-[#b5392a]" : ""}>
                    {dias <= 0 ? "será apagada agora" : `apagada em ${dias} dia${dias === 1 ? "" : "s"}`}
                  </span>
                </p>
              </div>
              <Button type="button" variant="secondary" disabled={!!processando} onClick={() => executar(a.id, () => restaurarDaLixeira(a))} className="h-8 px-3 text-[12.5px]">
                <RotateCcw size={14} />
                Restaurar
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!!processando}
                onClick={() => window.confirm(`Apagar "${a.titulo}" de vez? Não dá para desfazer.`) && executar(a.id, () => excluirDefinitivamente(a))}
                className="h-8 px-3 text-[12.5px] text-red-600"
              >
                <Trash2 size={14} />
                Apagar de vez
              </Button>
            </div>
          );
        })}
        {ordenados.length === 0 && <p className="p-6 text-center text-[13px] text-brand-faint">A lixeira está vazia.</p>}
      </div>
      {ordenados.length > 0 && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {confirmandoTudo ? (
            <>
              <span className="text-[12.5px] font-medium text-red-600">Apagar as {ordenados.length} anotações de vez?</span>
              <Button type="button" variant="danger" disabled={!!processando} onClick={() => void esvaziar()} className="h-8 px-3 text-[12.5px]">
                Sim, esvaziar
              </Button>
              <Button type="button" variant="secondary" onClick={() => setConfirmandoTudo(false)} className="h-8 px-3 text-[12.5px]">
                Não
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" disabled={!!processando} onClick={() => setConfirmandoTudo(true)} className="h-8 px-3 text-[12.5px] text-red-600">
              {processando === "tudo" ? "Esvaziando..." : "Esvaziar lixeira"}
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
