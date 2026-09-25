"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";

/** Confirmação de uma ação do fechamento, com texto (motivo/justificativa/observação) obrigatório ou opcional e, se pedido, anexos. */
export function AcaoFechamentoModal({
  titulo,
  descricao,
  rotulo,
  obrigatorio,
  confirmar,
  perigo,
  processando,
  permitirAnexos,
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
  /** Mostra o campo para anexar documentos complementares (até 3 MB cada). */
  permitirAnexos?: boolean;
  onCancelar: () => void;
  onConfirmar: (texto: string, arquivos: File[]) => void;
}) {
  const [texto, setTexto] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
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
        {permitirAnexos && (
          <div className="space-y-1.5">
            <label className="block text-[12.5px] font-bold text-brand-navy-2">Documentos complementares (opcional)</label>
            <input
              type="file"
              multiple
              onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
              className="block w-full text-[12.5px] text-brand-muted file:mr-3 file:rounded-[8px] file:border file:border-brand-border file:bg-white file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold file:text-brand-navy-2"
            />
            {arquivos.length > 0 && <p className="text-[11.5px] text-brand-faint">{arquivos.length} arquivo(s) selecionado(s).</p>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancelar} disabled={processando}>
            Cancelar
          </Button>
          <Button type="button" variant={perigo ? "danger" : "primary"} disabled={!pode || processando} onClick={() => onConfirmar(texto, arquivos)}>
            {processando ? "Salvando..." : confirmar}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
