"use client";

import { useState } from "react";
import { FileText, Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { EnvolvidoChave } from "@/types";

/** Antes de gerar a OS: o consultor marca, entre os principais envolvidos do projeto, quem participou da agenda. */
export function ParticipantesOsModal({
  open,
  envolvidos,
  gerando,
  onClose,
  onGerar,
}: {
  open: boolean;
  envolvidos: EnvolvidoChave[];
  gerando: boolean;
  onClose: () => void;
  onGerar: (participantes: EnvolvidoChave[]) => void;
}) {
  const [marcados, setMarcados] = useState<Set<number>>(new Set());

  const todos = marcados.size === envolvidos.length && envolvidos.length > 0;
  const alternar = (i: number) =>
    setMarcados((prev) => {
      const novo = new Set(prev);
      if (novo.has(i)) novo.delete(i);
      else novo.add(i);
      return novo;
    });

  return (
    <Modal open={open} onClose={onClose} title="Ordem de Serviço — participantes">
      <div className="space-y-4">
        <p className="text-[13px] text-brand-muted">
          Marque quem participou desta agenda. Os nomes escolhidos entram numa lista na OS. É opcional: pode gerar sem marcar ninguém.
        </p>

        <div className="overflow-hidden rounded-xl border border-brand-border">
          <label className="flex cursor-pointer items-center gap-2.5 border-b border-brand-border bg-brand-hover px-3.5 py-2.5 text-[13px] font-semibold text-brand-navy-2">
            <input
              type="checkbox"
              checked={todos}
              onChange={() => setMarcados(todos ? new Set() : new Set(envolvidos.map((_, i) => i)))}
            />
            <Users size={15} className="text-brand-faint" />
            Selecionar todos ({envolvidos.length})
          </label>
          <div className="max-h-72 divide-y divide-brand-border-soft overflow-y-auto">
            {envolvidos.map((e, i) => (
              <label key={i} className="flex cursor-pointer items-start gap-2.5 px-3.5 py-2.5 text-[13px] hover:bg-brand-hover">
                <input type="checkbox" className="mt-0.5" checked={marcados.has(i)} onChange={() => alternar(i)} />
                <span className="min-w-0">
                  <span className="block font-semibold text-brand-navy-2">{e.nome}</span>
                  <span className="block text-[12px] text-brand-faint">
                    {[e.cargo, e.vinculo].filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-brand-faint">
            {marcados.size === 0 ? "Nenhum participante marcado" : `${marcados.size} participante${marcados.size === 1 ? "" : "s"} na OS`}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={gerando} onClick={() => onGerar(envolvidos.filter((_, i) => marcados.has(i)))}>
              <FileText size={15} />
              {gerando ? "Gerando..." : "Gerar OS"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
