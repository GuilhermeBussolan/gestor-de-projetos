"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Textarea } from "@/components/ui/Field";
import type { DadosStatusParcela } from "@/lib/parcela";
import type { StatusParcela } from "@/types";

const TITULO: Partial<Record<StatusParcela, string>> = {
  FATURADO: "Marcar como Faturado",
  RECEBIDO: "Marcar como Recebido",
  CANCELADO: "Cancelar parcela",
};

export function AlterarStatusParcelaModal({
  statusAlvo,
  onCancelar,
  onConfirmar,
}: {
  statusAlvo: StatusParcela | null;
  onCancelar: () => void;
  onConfirmar: (dados: DadosStatusParcela) => Promise<void>;
}) {
  const [notaFiscal, setNotaFiscal] = useState("");
  const [data, setData] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function fechar() {
    setNotaFiscal("");
    setData("");
    setMotivo("");
    setErro("");
    onCancelar();
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (statusAlvo === "FATURADO" && !notaFiscal.trim()) {
      setErro("Informe a nota fiscal.");
      return;
    }
    if ((statusAlvo === "RECEBIDO" || statusAlvo === "CANCELADO") && !data) {
      setErro(`Informe a data de ${statusAlvo === "RECEBIDO" ? "recebimento" : "cancelamento"}.`);
      return;
    }
    if (statusAlvo === "CANCELADO" && !motivo.trim()) {
      setErro("Informe o motivo do cancelamento.");
      return;
    }
    setSalvando(true);
    try {
      await onConfirmar({
        notaFiscal: notaFiscal.trim(),
        dataRecebimento: statusAlvo === "RECEBIDO" ? data : undefined,
        dataCancelamento: statusAlvo === "CANCELADO" ? data : undefined,
        motivoCancelamento: motivo.trim(),
      });
      fechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open={!!statusAlvo} onClose={fechar} title={statusAlvo ? (TITULO[statusAlvo] ?? "Alterar status") : ""}>
      {statusAlvo && (
        <form onSubmit={confirmar} className="space-y-4">
          {statusAlvo === "FATURADO" && (
            <FormRow label="Nota fiscal (obrigatório)">
              <Input
                value={notaFiscal}
                onChange={(e) => setNotaFiscal(e.target.value)}
                maxLength={200}
                placeholder="Número/descrição da nota fiscal"
                required
                autoFocus
              />
            </FormRow>
          )}
          {(statusAlvo === "RECEBIDO" || statusAlvo === "CANCELADO") && (
            <FormRow label={statusAlvo === "RECEBIDO" ? "Data de recebimento" : "Data de cancelamento"}>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required autoFocus />
            </FormRow>
          )}
          {statusAlvo === "CANCELADO" && (
            <FormRow label="Motivo do cancelamento (obrigatório)">
              <Textarea
                rows={4}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={1000}
                required
              />
            </FormRow>
          )}
          {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Confirmar"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
