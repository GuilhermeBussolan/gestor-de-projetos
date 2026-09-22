"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Textarea } from "@/components/ui/Field";
import { existeParcelaAnteriorPendente, preverDatasFuturas, type DadosStatusParcela } from "@/lib/parcela";
import type { Parcela, StatusParcela } from "@/types";

const TITULO: Partial<Record<StatusParcela, string>> = {
  LIBERADO: "Liberar parcela",
  FATURADO: "Marcar como Faturado",
  RECEBIDO: "Marcar como Recebido",
  CANCELADO: "Cancelar parcela",
};

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function dataBR(iso: string) {
  return iso.split("-").reverse().join("/");
}

export function AlterarStatusParcelaModal({
  statusAlvo,
  parcelas,
  numero,
  onCancelar,
  onConfirmar,
}: {
  statusAlvo: StatusParcela | null;
  /** Todas as parcelas do projeto — usadas para bloquear liberação fora de ordem e prever as datas futuras. */
  parcelas: Parcela[];
  numero: number;
  onCancelar: () => void;
  onConfirmar: (dados: DadosStatusParcela) => Promise<void>;
}) {
  const [notaFiscal, setNotaFiscal] = useState("");
  const [dataLiberacao, setDataLiberacao] = useState(hojeIso);
  const [data, setData] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const bloqueadaPorOrdem = statusAlvo === "LIBERADO" && existeParcelaAnteriorPendente(parcelas, numero);
  const preview =
    statusAlvo === "LIBERADO" && dataLiberacao && !bloqueadaPorOrdem
      ? preverDatasFuturas(parcelas, numero, dataLiberacao)
      : [];

  function fechar() {
    setNotaFiscal("");
    setDataLiberacao(hojeIso());
    setData("");
    setMotivo("");
    setErro("");
    onCancelar();
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (statusAlvo === "LIBERADO" && !dataLiberacao) {
      setErro("Informe a data de liberação.");
      return;
    }
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
        dataLiberacaoIso: statusAlvo === "LIBERADO" ? dataLiberacao : undefined,
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
          {bloqueadaPorOrdem && (
            <p className="flex items-start gap-2 rounded-md bg-[#fdeceb] p-3 text-sm text-[#b5392a]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Existe uma parcela anterior ainda aguardando liberação. Libere as parcelas em ordem.
            </p>
          )}
          {statusAlvo === "LIBERADO" && !bloqueadaPorOrdem && (
            <>
              <FormRow label="Data de liberação">
                <Input
                  type="date"
                  value={dataLiberacao}
                  onChange={(e) => setDataLiberacao(e.target.value)}
                  required
                  autoFocus
                />
              </FormRow>
              {preview.length > 0 && (
                <div className="rounded-md border border-brand-border bg-brand-hover p-3 text-[12.5px] text-brand-navy-2">
                  <p className="mb-1.5 font-semibold">Datas previstas recalculadas:</p>
                  <ul className="space-y-0.5">
                    {preview.map((p) => (
                      <li key={p.numero} className="flex items-center justify-between gap-3">
                        <span>{p.descricao}</span>
                        <span className="font-bold">
                          {p.dataAnterior ? `${dataBR(p.dataAnterior)} → ` : ""}
                          {dataBR(p.dataNova)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
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
            <Button type="submit" disabled={salvando || bloqueadaPorOrdem}>
              {salvando ? "Salvando..." : "Confirmar"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
