"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Textarea } from "@/components/ui/Field";
import { TERMOMETRO_CONFIG, TERMOMETRO_ORDEM } from "@/lib/constants";
import { alterarTermometro, termometroEfetivo } from "@/lib/termometro";
import type { Projeto, Termometro, Usuario } from "@/types";

export function AlterarTermometroModal({
  projeto,
  usuario,
  onClose,
}: {
  projeto: Projeto | null;
  usuario: Usuario;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Termometro>(projeto ? termometroEfetivo(projeto) : "normal");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function fechar() {
    setObservacao("");
    setErro("");
    onClose();
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!projeto) return;
    setErro("");
    if (!observacao.trim()) {
      setErro("Descreva o motivo dessa alteração.");
      return;
    }
    setSalvando(true);
    try {
      await alterarTermometro(projeto, status, observacao, usuario);
      fechar();
    } catch (err) {
      console.error("Falha ao alterar termômetro:", err);
      setErro(err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open={!!projeto} onClose={fechar} title="Alterar termômetro do projeto">
      {projeto && (
        <form onSubmit={confirmar} className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-brand-muted">Status</p>
            <div className="flex gap-2">
              {TERMOMETRO_ORDEM.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setStatus(t)}
                  style={{
                    backgroundColor: status === t ? TERMOMETRO_CONFIG[t].bg : "transparent",
                    color: TERMOMETRO_CONFIG[t].text,
                    borderColor: TERMOMETRO_CONFIG[t].text,
                  }}
                  className={`flex-1 rounded-[10px] border px-3 py-2 text-[12.5px] font-bold transition-opacity ${
                    status === t ? "" : "opacity-45 hover:opacity-75"
                  }`}
                >
                  {TERMOMETRO_CONFIG[t].label}
                </button>
              ))}
            </div>
          </div>

          <FormRow label="Observação (obrigatório — motivo dessa alteração)">
            <Textarea
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              maxLength={500}
              required
              autoFocus
            />
          </FormRow>

          {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
