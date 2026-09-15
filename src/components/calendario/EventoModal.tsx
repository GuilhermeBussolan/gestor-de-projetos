"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Select, Textarea } from "@/components/ui/Field";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Cliente, EventoCalendario, Periodo, Projeto, Recurso } from "@/types";

export function EventoModal({
  aberto,
  onClose,
  data,
  periodo,
  eventoEditando,
  projetos,
  clientes,
  consultores,
}: {
  aberto: boolean;
  onClose: () => void;
  data: string;
  periodo: Periodo;
  eventoEditando: EventoCalendario | null;
  projetos: Projeto[];
  clientes: Cliente[];
  consultores: Recurso[];
}) {
  const [projetoId, setProjetoId] = useState(eventoEditando?.projetoId ?? "");
  const [recursoId, setRecursoId] = useState(eventoEditando?.recursoId ?? "");
  const [descricao, setDescricao] = useState(eventoEditando?.descricao ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!projetoId || !recursoId) return;
    setSalvando(true);
    try {
      if (eventoEditando) {
        await updateDoc(doc(db, "eventosCalendario", eventoEditando.id), {
          projetoId,
          recursoId,
          descricao,
        });
      } else {
        await addDoc(collection(db, "eventosCalendario"), {
          data,
          periodo,
          projetoId,
          recursoId,
          descricao,
          createdAt: Date.now(),
        });
      }
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!eventoEditando) return;
    if (!confirm("Excluir este atendimento?")) return;
    await deleteDoc(doc(db, "eventosCalendario", eventoEditando.id));
    onClose();
  }

  return (
    <Modal open={aberto} onClose={onClose} title={eventoEditando ? "Editar atendimento" : "Novo atendimento"}>
      <form onSubmit={salvar} className="space-y-4">
        <FormRow label="Projeto (cliente)">
          <Select value={projetoId} onChange={(e) => setProjetoId(e.target.value)} required>
            <option value="">Selecione...</option>
            {projetos.map((p) => {
              const cliente = clientes.find((c) => c.id === p.clienteId);
              return (
                <option key={p.id} value={p.id}>
                  {nomeExibicaoCliente(cliente)} — {p.codigoProposta}
                </option>
              );
            })}
          </Select>
        </FormRow>
        <FormRow label="Recurso (consultor)">
          <Select value={recursoId} onChange={(e) => setRecursoId(e.target.value)} required>
            <option value="">Selecione...</option>
            {consultores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nomeCompleto}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Descrição">
          <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </FormRow>
        <div className="flex items-center justify-between pt-2">
          <div>
            {eventoEditando && (
              <Button type="button" variant="danger" onClick={excluir}>
                Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
