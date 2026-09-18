"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/** Confirmação dentro do app (o confirm() nativo é bloqueado em alguns navegadores embutidos). */
export function ConfirmDialog({
  open,
  titulo,
  mensagem,
  confirmarLabel = "Confirmar",
  perigo = false,
  onConfirmar,
  onCancelar,
}: {
  open: boolean;
  titulo: string;
  mensagem: string;
  confirmarLabel?: string;
  perigo?: boolean;
  onConfirmar: () => Promise<void>;
  onCancelar: () => void;
}) {
  const [executando, setExecutando] = useState(false);
  const [erro, setErro] = useState("");

  async function confirmar() {
    setExecutando(true);
    setErro("");
    try {
      await onConfirmar();
      onCancelar();
    } catch (err) {
      console.error("Falha na ação confirmada:", err);
      setErro("Não foi possível concluir. Tente novamente.");
    } finally {
      setExecutando(false);
    }
  }

  function cancelar() {
    setErro("");
    onCancelar();
  }

  return (
    <Modal open={open} onClose={cancelar} title={titulo}>
      <p className="text-sm text-brand-muted">{mensagem}</p>
      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}
      <div className="flex justify-end gap-2 pt-5">
        <Button type="button" variant="secondary" onClick={cancelar} disabled={executando}>
          Cancelar
        </Button>
        <Button type="button" variant={perigo ? "danger" : "primary"} onClick={confirmar} disabled={executando}>
          {executando ? "Aguarde..." : confirmarLabel}
        </Button>
      </div>
    </Modal>
  );
}
