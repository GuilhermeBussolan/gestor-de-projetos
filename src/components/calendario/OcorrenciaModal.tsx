"use client";

import { useState } from "react";
import { collection, doc, getDocs, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AtividadesEscopoChecklist } from "@/components/projetos/AtividadesEscopoChecklist";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { calcularTotalHoras, formatarHoras } from "@/lib/horas";
import { registrarContato } from "@/lib/contato";
import { statusAoConfirmar, statusEfetivo } from "@/lib/statusHora";
import type { Cliente, EventoCalendario, Projeto, Recurso, Usuario } from "@/types";

type Decisao = "realizada" | "cancelada" | "";

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
  const [decisao, setDecisao] = useState<Decisao>("");
  const [memo, setMemo] = useState("");
  const [atividadesMarcadas, setAtividadesMarcadas] = useState<string[]>(
    ocorrencia.atividadesRealizadas ?? []
  );
  const [salvando, setSalvando] = useState(false);

  const projetosDisponiveis = souConsultor
    ? projetos.filter((p) => p.consultorIds?.includes(meuRecursoId) && p.status !== "finalizado")
    : projetos;

  const projetoSelecionado = projetos.find((p) => p.id === projetoId);
  const atividadesEscopo = projetoSelecionado?.escopoAtividades ?? [];

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!decisao || !projetoId) return;
    if (decisao === "realizada" && !memo.trim()) return;
    setSalvando(true);
    try {
      const totalHoras = decisao === "realizada" ? calcularTotalHoras(horaInicio, horaFim, horaDesconto) : 0;
      const novoStatus =
        decisao === "realizada" ? statusAoConfirmar(recurso, usuario.perfil) : "cancelado";

      await updateDoc(doc(db, "eventosCalendario", ocorrencia.id), {
        projetoId,
        horaInicio,
        horaFim,
        horaDesconto,
        totalHoras,
        status: novoStatus,
        motivoRejeicao: null,
        descricao: decisao === "realizada" ? memo.trim() : ocorrencia.descricao,
        atividadesRealizadas: decisao === "realizada" ? atividadesMarcadas : null,
      });

      if (decisao === "realizada" && memo.trim()) {
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
          if (statusEfetivo(dados) !== "previsto" || dados.data <= ocorrencia.data) continue;
          if (decisao === "cancelada") {
            batch.update(d.ref, { status: "cancelado", totalHoras: 0 });
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
      <p className="text-sm text-brand-muted">
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
      <p className="text-sm text-brand-muted">
        Total: <strong>{formatarHoras(calcularTotalHoras(horaInicio, horaFim, horaDesconto))}</strong>
      </p>

      {ocorrencia.seriesId && (
        <label className="flex items-center gap-2 text-sm text-brand-muted">
          <input
            type="checkbox"
            checked={aplicarFuturas}
            onChange={(e) => setAplicarFuturas(e.target.checked)}
          />
          Aplicar projeto/horário às próximas ocorrências pendentes desta série
        </label>
      )}

      <FormRow label="Esta agenda foi...">
        <Select value={decisao} onChange={(e) => setDecisao(e.target.value as Decisao)} required>
          <option value="">Selecione...</option>
          <option value="realizada">Realizada</option>
          <option value="cancelada">Cancelada</option>
        </Select>
      </FormRow>

      {decisao === "realizada" && (
        <>
          <FormRow label="O que foi feito no atendimento?">
            <Textarea
              rows={3}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Esse texto também aparece no histórico de contato do projeto, no Dashboard."
              required
            />
          </FormRow>
          {statusAoConfirmar(recurso, usuario.perfil) === "aguardando_aprovacao" && (
            <p className="text-xs text-brand-faint">
              Ao confirmar, essas horas vão para a fila de aprovação do coordenador antes de contar
              como realizadas de verdade.
            </p>
          )}
          {atividadesEscopo.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium text-brand-navy-2">
                Atividades do escopo realizadas hoje (opcional)
              </p>
              <AtividadesEscopoChecklist
                atividades={atividadesEscopo}
                marcadas={atividadesMarcadas}
                onChange={setAtividadesMarcadas}
              />
            </div>
          )}
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando || !decisao}>
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
