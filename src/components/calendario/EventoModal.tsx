"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { calcularTotalHoras, formatarHoras } from "@/lib/horas";
import { STATUS_HORA_CONFIG, statusAoConfirmar, statusEfetivo, statusNaCriacao } from "@/lib/statusHora";
import type { Cliente, EventoCalendario, Projeto, Recurso, Usuario } from "@/types";

function timestampAtual(): number {
  return Date.now();
}

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
  const [dataEvento, setDataEvento] = useState(eventoEditando?.data ?? data);
  const [horaInicio, setHoraInicio] = useState(
    eventoEditando?.horaInicio ?? horaInicioPadrao ?? "08:00"
  );
  const [horaFim, setHoraFim] = useState(eventoEditando?.horaFim ?? horaFimPadrao ?? "12:00");
  const [horaDesconto, setHoraDesconto] = useState(eventoEditando?.horaDesconto ?? "00:00");
  const [descricao, setDescricao] = useState(eventoEditando?.descricao ?? "");
  const [atividadesMarcadas, setAtividadesMarcadas] = useState<string[]>(
    eventoEditando?.atividadesRealizadas ?? []
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const recurso = recursos.find((r) => r.id === recursoId);
  const hojeISO = new Date().toISOString().slice(0, 10);
  const statusAtual = eventoEditando ? statusEfetivo(eventoEditando) : null;
  const eraRejeitado = statusAtual === "rejeitado";

  const projetosDisponiveis = souConsultorEditandoMeuEvento
    ? projetos.filter((p) => p.consultorIds?.includes(meuRecursoId) && p.status !== "finalizado")
    : projetos;

  const projetoSelecionado = projetos.find((p) => p.id === projetoId);
  const atividadesEscopo = projetoSelecionado?.escopoAtividades ?? [];

  function toggleAtividade(id: string) {
    setAtividadesMarcadas((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!projetoId || !recursoId) return;
    if (souConsultorEditandoMeuEvento && dataEvento > hojeISO) {
      setErro("Não é permitido apontar horas em datas futuras.");
      return;
    }
    setSalvando(true);
    try {
      const totalHoras = calcularTotalHoras(horaInicio, horaFim, horaDesconto);
      const dados = {
        data: dataEvento,
        projetoId,
        recursoId,
        horaInicio,
        horaFim,
        horaDesconto,
        totalHoras,
        descricao,
        atividadesRealizadas: atividadesMarcadas,
      };
      if (eventoEditando) {
        await updateDoc(doc(db, "eventosCalendario", eventoEditando.id), {
          ...dados,
          ...(eraRejeitado
            ? { status: statusAoConfirmar(recurso, usuario.perfil), motivoRejeicao: null }
            : {}),
        });
      } else {
        await addDoc(collection(db, "eventosCalendario"), {
          ...dados,
          origem: "avulso",
          status: statusNaCriacao(recurso, usuario.perfil),
          createdAt: timestampAtual(),
        });
      }
      onClose();
    } catch (err) {
      console.error("Falha ao salvar apontamento:", err, {
        recursoId,
        meuRecursoId,
        projetoId,
        souConsultorEditandoMeuEvento,
        projetoStatus: projetoSelecionado?.status,
        projetoConsultorIds: projetoSelecionado?.consultorIds,
      });
      setErro(
        err instanceof Error
          ? `Não foi possível salvar. [${(err as { code?: string }).code ?? "erro"}] ${err.message}`
          : "Não foi possível salvar."
      );
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
      title={
        eraRejeitado
          ? "Ajustar e reenviar"
          : eventoEditando
            ? "Editar apontamento avulso"
            : "Novo apontamento avulso"
      }
    >
      <form onSubmit={salvar} className="space-y-4">
        {eventoEditando && statusAtual && (
          <span
            className="inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold"
            style={{
              backgroundColor: STATUS_HORA_CONFIG[statusAtual].bg,
              color: STATUS_HORA_CONFIG[statusAtual].text,
            }}
          >
            {STATUS_HORA_CONFIG[statusAtual].label}
          </span>
        )}
        {eraRejeitado && eventoEditando?.motivoRejeicao && (
          <p className="rounded-md bg-[#fdeceb] p-3 text-sm text-[#b5392a]">
            <strong>Motivo da rejeição:</strong> {eventoEditando.motivoRejeicao}
          </p>
        )}

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
          <p className="text-sm text-brand-muted">
            Lançando para: <strong>{recurso.nomeCompleto}</strong>
          </p>
        )}

        <FormRow label="Projeto (cliente)">
          <Select
            value={projetoId}
            onChange={(e) => {
              setProjetoId(e.target.value);
              setAtividadesMarcadas([]);
            }}
            required
          >
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
              {souConsultorEditandoMeuEvento &&
              projetos.some((p) => p.consultorIds?.includes(meuRecursoId))
                ? "Todos os seus projetos estão finalizados — fale com um coordenador ou administrador."
                : "Você ainda não está vinculado a nenhum projeto como consultor."}
            </p>
          )}
        </FormRow>

        <FormRow label="Data">
          <Input
            type="date"
            value={dataEvento}
            onChange={(e) => setDataEvento(e.target.value)}
            max={souConsultorEditandoMeuEvento ? hojeISO : undefined}
            required
          />
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
        <p className="text-sm text-brand-muted">
          Total: <strong>{formatarHoras(calcularTotalHoras(horaInicio, horaFim, horaDesconto))}</strong>
        </p>

        <FormRow label="Descrição (opcional)">
          <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </FormRow>

        {atividadesEscopo.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium text-brand-navy-2">
              Atividades do escopo realizadas hoje (opcional)
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-brand-border p-2">
              {atividadesEscopo.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={atividadesMarcadas.includes(a.id)}
                    onChange={() => toggleAtividade(a.id)}
                  />
                  {a.descricao}
                </label>
              ))}
            </div>
          </div>
        )}

        {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

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
              {salvando ? "Salvando..." : eraRejeitado ? "Reenviar para aprovação" : "Salvar"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
