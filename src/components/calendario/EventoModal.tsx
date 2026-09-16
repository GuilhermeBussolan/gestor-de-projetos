"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { calcularTotalHoras, formatarHoras } from "@/lib/horas";
import type { Cliente, EventoCalendario, Projeto, Recurso, Usuario } from "@/types";

export function EventoModal({
  aberto,
  onClose,
  data,
  horaInicioPadrao,
  horaFimPadrao,
  eventoEditando,
  projetos,
  clientes,
  recursos,
  usuario,
}: {
  aberto: boolean;
  onClose: () => void;
  data: string;
  horaInicioPadrao: string;
  horaFimPadrao: string;
  eventoEditando: EventoCalendario | null;
  projetos: Projeto[];
  clientes: Cliente[];
  recursos: Recurso[];
  usuario: Usuario;
}) {
  const souConsultorEditandoMeuEvento = usuario.perfil === "consultor";
  const meuRecursoId = usuario.recursoId ?? "";

  const [projetoId, setProjetoId] = useState(eventoEditando?.projetoId ?? "");
  const [recursoId, setRecursoId] = useState(
    eventoEditando?.recursoId ?? (souConsultorEditandoMeuEvento ? meuRecursoId : "")
  );
  const [horaInicio, setHoraInicio] = useState(
    eventoEditando?.horaInicio ?? horaInicioPadrao ?? "08:00"
  );
  const [horaFim, setHoraFim] = useState(eventoEditando?.horaFim ?? horaFimPadrao ?? "12:00");
  const [horaDesconto, setHoraDesconto] = useState(eventoEditando?.horaDesconto ?? "00:00");
  const [descricao, setDescricao] = useState(eventoEditando?.descricao ?? "");
  const [salvando, setSalvando] = useState(false);

  const recurso = recursos.find((r) => r.id === recursoId);

  const projetosDisponiveis = souConsultorEditandoMeuEvento
    ? projetos.filter((p) => p.consultorIds?.includes(meuRecursoId))
    : projetos;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!projetoId || !recursoId) return;
    setSalvando(true);
    try {
      const totalHoras = calcularTotalHoras(horaInicio, horaFim, horaDesconto);
      const dados = {
        projetoId,
        recursoId,
        horaInicio,
        horaFim,
        horaDesconto,
        totalHoras,
        descricao,
      };
      if (eventoEditando) {
        await updateDoc(doc(db, "eventosCalendario", eventoEditando.id), dados);
      } else {
        await addDoc(collection(db, "eventosCalendario"), {
          data,
          ...dados,
          origem: "avulso",
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
    if (!confirm("Excluir este lançamento?")) return;
    await deleteDoc(doc(db, "eventosCalendario", eventoEditando.id));
    onClose();
  }

  return (
    <Modal
      open={aberto}
      onClose={onClose}
      title={eventoEditando ? "Editar apontamento avulso" : "Novo apontamento avulso"}
    >
      <form onSubmit={salvar} className="space-y-4">
        {!souConsultorEditandoMeuEvento && (
          <FormRow label="Recurso">
            <Select value={recursoId} onChange={(e) => setRecursoId(e.target.value)} required>
              <option value="">Selecione...</option>
              {recursos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nomeCompleto}
                </option>
              ))}
            </Select>
          </FormRow>
        )}
        {souConsultorEditandoMeuEvento && recurso && (
          <p className="text-sm text-slate-500">
            Lançando para: <strong>{recurso.nomeCompleto}</strong>
          </p>
        )}

        <FormRow label="Projeto (cliente)">
          <Select value={projetoId} onChange={(e) => setProjetoId(e.target.value)} required>
            <option value="">Selecione...</option>
            {projetosDisponiveis.map((p) => {
              const cliente = clientes.find((c) => c.id === p.clienteId);
              return (
                <option key={p.id} value={p.id}>
                  {nomeExibicaoCliente(cliente)} — {p.codigoProposta}
                </option>
              );
            })}
          </Select>
          {projetosDisponiveis.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">
              Você ainda não está vinculado a nenhum projeto como consultor.
            </p>
          )}
        </FormRow>

        <div className="grid grid-cols-3 gap-3">
          <FormRow label="Hora início">
            <Input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              required
            />
          </FormRow>
          <FormRow label="Hora fim">
            <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} required />
          </FormRow>
          <FormRow label="Desconto">
            <Input
              type="time"
              value={horaDesconto}
              onChange={(e) => setHoraDesconto(e.target.value)}
            />
          </FormRow>
        </div>
        <p className="text-sm text-slate-500">
          Total: <strong>{formatarHoras(calcularTotalHoras(horaInicio, horaFim, horaDesconto))}</strong>
        </p>

        <FormRow label="Descrição (opcional)">
          <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
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
