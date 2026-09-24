"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";

/** Confirmação de uma ação do fechamento, com texto (motivo/justificativa/observação) obrigatório ou opcional. */
export function AcaoFechamentoModal({
  titulo,
  descricao,
  rotulo,
  obrigatorio,
  confirmar,
  perigo,
  processando,
  onCancelar,
  onConfirmar,
}: {
  titulo: string;
  descricao?: string;
  rotulo: string;
  obrigatorio: boolean;
  confirmar: string;
  perigo?: boolean;
  processando: boolean;
  onCancelar: () => void;
  onConfirmar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const pode = !obrigatorio || texto.trim().length >= 3;
  return (
    <Modal open onClose={onCancelar} title={titulo}>
      <div className="space-y-4">
        {descricao && <p className="text-[13px] text-brand-muted">{descricao}</p>}
        <div className="space-y-1.5">
          <label className="block text-[12.5px] font-bold text-brand-navy-2">
            {rotulo} {obrigatorio && <span className="text-[#b5392a]">*</span>}
          </label>
          <Textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancelar} disabled={processando}>
            Cancelar
          </Button>
          <Button type="button" variant={perigo ? "danger" : "primary"} disabled={!pode || processando} onClick={() => onConfirmar(texto)}>
            {processando ? "Salvando..." : confirmar}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
