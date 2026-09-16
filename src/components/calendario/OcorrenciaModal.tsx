"use client";

import { useState } from "react";
import { collection, doc, getDocs, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { calcularTotalHoras, formatarHoras } from "@/lib/horas";
import { registrarContato } from "@/lib/contato";
import type { Cliente, EventoCalendario, Projeto, Recurso, StatusOcorrencia, Usuario } from "@/types";

function OcorrenciaForm({
  ocorrencia,
  onClose,
  projetos,
  clientes,
  recursos,
  usuario,
}: {
  ocorrencia: EventoCalendario;
  onClose: () => void;
  projetos: Projeto[];
  clientes: Cliente[];
  recursos: Recurso[];
  usuario: Usuario;
}) {
  const souConsultor = usuario.perfil === "consultor";
  const meuRecursoId = usuario.recursoId ?? "";
  const recurso = recursos.find((r) => r.id === ocorrencia.recursoId);

  const [projetoId, setProjetoId] = useState(ocorrencia.projetoId);
  const [horaInicio, setHoraInicio] = useState(ocorrencia.horaInicio);
  const [horaFim, setHoraFim] = useState(ocorrencia.horaFim);
  const [horaDesconto, setHoraDesconto] = useState(ocorrencia.horaDesconto || "00:00");
  const [aplicarFuturas, setAplicarFuturas] = useState(false);
  const [status, setStatus] = useState<StatusOcorrencia | "">("");
  const [memo, setMemo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const projetosDisponiveis = souConsultor
    ? projetos.filter((p) => p.consultorIds?.includes(meuRecursoId))
    : projetos;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!status || !projetoId) return;
    if (status === "realizada" && !memo.trim()) return;
    setSalvando(true);
    try {
      const totalHoras = status === "realizada" ? calcularTotalHoras(horaInicio, horaFim, horaDesconto) : 0;

      await updateDoc(doc(db, "eventosCalendario", ocorrencia.id), {
        projetoId,
        horaInicio,
        horaFim,
        horaDesconto,
        totalHoras,
        status,
        descricao: status === "realizada" ? memo.trim() : ocorrencia.descricao,
      });

      if (status === "realizada" && memo.trim()) {
        await registrarContato(projetoId, memo.trim(), usuario);
      }

      if (aplicarFuturas && ocorrencia.seriesId) {
        const snap = await getDocs(
          query(
            collection(db, "eventosCalendario"),
            where("seriesId", "==", ocorrencia.seriesId),
            where("recursoId", "==", ocorrencia.recursoId)
          )
        );
        const batch = writeBatch(db);
        for (const d of snap.docs) {
          const dados = d.data() as EventoCalendario;
          if (d.id === ocorrencia.id) continue;
          if (dados.status !== "pendente" || dados.data <= ocorrencia.data) continue;
          if (status === "cancelada") {
            batch.update(d.ref, { status: "cancelada", totalHoras: 0 });
          } else {
            batch.update(d.ref, { projetoId, horaInicio, horaFim, horaDesconto });
          }
        }
        await batch.commit();
      }

      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <p className="text-sm text-slate-500">
        {recurso?.nomeCompleto} · {ocorrencia.data.split("-").reverse().join("/")}
      </p>

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
      </FormRow>

      <div className="grid grid-cols-3 gap-3">
        <FormRow label="Hora início">
          <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} required />
        </FormRow>
        <FormRow label="Hora fim">
          <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} required />
        </FormRow>
        <FormRow label="Desconto">
          <Input type="time" value={horaDesconto} onChange={(e) => setHoraDesconto(e.target.value)} />
        </FormRow>
      </div>
      <p className="text-sm text-slate-500">
        Total: <strong>{formatarHoras(calcularTotalHoras(horaInicio, horaFim, horaDesconto))}</strong>
      </p>

      {ocorrencia.seriesId && (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={aplicarFuturas}
            onChange={(e) => setAplicarFuturas(e.target.checked)}
          />
          Aplicar projeto/horário às próximas ocorrências pendentes desta série
        </label>
      )}

      <FormRow label="Esta agenda foi...">
        <Select value={status} onChange={(e) => setStatus(e.target.value as StatusOcorrencia)} required>
          <option value="">Selecione...</option>
          <option value="realizada">Realizada</option>
          <option value="cancelada">Cancelada</option>
        </Select>
      </FormRow>

      {status === "realizada" && (
        <FormRow label="O que foi feito no atendimento?">
          <Textarea
            rows={3}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Esse texto também aparece no histórico de contato do projeto, no Dashboard."
            required
          />
        </FormRow>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando || !status}>
          {salvando ? "Salvando..." : "Confirmar"}
        </Button>
      </div>
    </form>
  );
}

export function OcorrenciaModal({
  ocorrencia,
  onClose,
  projetos,
  clientes,
  recursos,
  usuario,
}: {
  ocorrencia: EventoCalendario | null;
  onClose: () => void;
  projetos: Projeto[];
  clientes: Cliente[];
  recursos: Recurso[];
  usuario: Usuario;
}) {
  return (
    <Modal open={!!ocorrencia} onClose={onClose} title="Confirmar agenda">
      {ocorrencia && (
        <OcorrenciaForm
          key={ocorrencia.id}
          ocorrencia={ocorrencia}
          onClose={onClose}
          projetos={projetos}
          clientes={clientes}
          recursos={recursos}
          usuario={usuario}
        />
      )}
    </Modal>
  );
}
