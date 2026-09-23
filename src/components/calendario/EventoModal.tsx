"use client";

import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { Modal } from "@/components/ui/Modal";
import { AtividadesEscopoChecklist } from "@/components/projetos/AtividadesEscopoChecklist";
import { ComparativoPrevistoRealizado } from "@/components/calendario/ComparativoPrevistoRealizado";
import { calcularDatasAtividades } from "@/lib/dashboardCalc";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { avaliarBlocosAoApontar } from "@/lib/comparativoHoras";
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
  eventos,
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
  eventos: EventoCalendario[];
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
  // "Em andamento" = ainda haverá outros apontamentos nas atividades marcadas; desligado = finalizadas.
  const [emAndamento, setEmAndamento] = useState(
    eventoEditando ? eventoEditando.atividadesFinalizadas === false : true
  );
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [erro, setErro] = useState("");

  const recurso = recursos.find((r) => r.id === recursoId);
  const hojeISO = new Date().toISOString().slice(0, 10);
  const statusAtual = eventoEditando ? statusEfetivo(eventoEditando) : null;
  const eraRejeitado = statusAtual === "rejeitado";

  const projetosDisponiveis = souConsultorEditandoMeuEvento
    ? projetos.filter((p) => p.consultorIds?.includes(meuRecursoId) && p.status !== "finalizado")
    : projetos;

  const projetoSelecionado = projetos.find((p) => p.id === projetoId);
  const atividadesEscopo = useMemo(() => projetoSelecionado?.escopoAtividades ?? [], [projetoSelecionado]);

  // O que já foi feito no escopo é do PROJETO inteiro, não só do que este consultor apontou — por
  // isso busca à parte, sem o filtro por recurso que a tela de calendário pessoal usa (a regra do
  // Firestore libera ler apontamentos de colegas dentro de um projeto em que o usuário está alocado).
  const { data: eventosDoProjeto } = useCollection<EventoCalendario>(
    "eventosCalendario",
    [where("projetoId", "==", projetoId)],
    !!projetoId,
    [projetoId]
  );

  const datasAtividades = useMemo(
    () => calcularDatasAtividades(projetoId, eventosDoProjeto),
    [projetoId, eventosDoProjeto]
  );

  const totalHorasAtual = calcularTotalHoras(horaInicio, horaFim, horaDesconto);

  // Previsto x Realizado: por atividade marcada (ex: "Riscos" = 8h), não pelo grupo de rotina. Só
  // entra em cena quando o escopo do projeto tem duração cadastrada (cronograma importado) —
  // projetos antigos, sem isso, não geram alerta nenhum.
  const avaliacaoBlocos = useMemo(
    () =>
      avaliarBlocosAoApontar(
        projetoId,
        atividadesEscopo,
        atividadesMarcadas,
        totalHorasAtual,
        !emAndamento,
        eventosDoProjeto,
        eventoEditando?.id
      ).filter((b) => b.horasPrevistas > 0),
    [projetoId, atividadesEscopo, atividadesMarcadas, totalHorasAtual, emAndamento, eventosDoProjeto, eventoEditando?.id]
  );
  const precisaObservacao = avaliacaoBlocos.some((b) => b.cenario === "acima");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!projetoId || !recursoId) return;
    if (souConsultorEditandoMeuEvento && dataEvento > hojeISO) {
      setErro("Não é permitido apontar horas em datas futuras.");
      return;
    }
    const totalHoras = calcularTotalHoras(horaInicio, horaFim, horaDesconto);
    const totalDoDia = eventos
      .filter(
        (e) =>
          e.id !== eventoEditando?.id &&
          e.recursoId === recursoId &&
          e.data === dataEvento &&
          statusEfetivo(e) !== "cancelado"
      )
      .reduce((acc, e) => acc + e.totalHoras, 0);
    if (totalDoDia + totalHoras > 24) {
      setErro("O total de horas apontadas nesse dia para esse recurso passaria de 24 horas.");
      return;
    }
    const temConflito = eventos.some(
      (e) =>
        e.id !== eventoEditando?.id &&
        e.recursoId === recursoId &&
        e.data === dataEvento &&
        !e.retroativo &&
        statusEfetivo(e) !== "cancelado" &&
        horaInicio < e.horaFim &&
        e.horaInicio < horaFim
    );
    if (temConflito) {
      setErro("Já existe um apontamento para esse mesmo dia e horário.");
      return;
    }
    if (precisaObservacao && !descricao.trim()) {
      setErro("As horas apontadas ultrapassaram o previsto — informe uma observação justificando o excedente.");
      return;
    }
    setSalvando(true);
    try {
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
        atividadesFinalizadas: atividadesMarcadas.length > 0 ? !emAndamento : true,
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
      console.error("Falha ao salvar apontamento:", err);
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!eventoEditando) return;
    try {
      await deleteDoc(doc(db, "eventosCalendario", eventoEditando.id));
      onClose();
    } catch (err) {
      console.error("Falha ao excluir apontamento:", err);
      setConfirmandoExclusao(false);
      setErro("Não foi possível excluir. Tente novamente.");
    }
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

        {atividadesEscopo.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium text-brand-navy-2">
              Atividades do escopo realizadas hoje (opcional)
            </p>
            <AtividadesEscopoChecklist
              atividades={atividadesEscopo}
              marcadas={atividadesMarcadas}
              onChange={setAtividadesMarcadas}
              datas={datasAtividades}
              className="max-h-56"
            />
          </div>
        )}

        {atividadesMarcadas.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium text-brand-navy-2">Situação das atividades marcadas</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { valor: true, titulo: "Em andamento", ajuda: "Haverá novos apontamentos" },
                { valor: false, titulo: "Finalizado", ajuda: "Concluí o que marquei" },
              ].map((op) => {
                const ativo = emAndamento === op.valor;
                return (
                  <button
                    key={op.titulo}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setEmAndamento(op.valor)}
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                      ativo
                        ? "border-brand-accent bg-brand-accent-soft"
                        : "border-brand-border bg-white hover:bg-brand-hover"
                    }`}
                  >
                    <span className={`block text-[13px] font-bold ${ativo ? "text-brand-accent" : "text-brand-navy-2"}`}>
                      {op.titulo}
                    </span>
                    <span className="block text-[11px] text-brand-muted">{op.ajuda}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <ComparativoPrevistoRealizado blocos={avaliacaoBlocos} />

        <FormRow label={precisaObservacao ? "Observação (obrigatória — horas acima do previsto)" : "Descrição (opcional)"}>
          <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} required={precisaObservacao} />
        </FormRow>

        {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

        <div className="flex items-center justify-between pt-2">
          <div>
            {eventoEditando &&
              (confirmandoExclusao ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-red-600">Excluir este lançamento?</span>
                  <Button type="button" variant="danger" onClick={excluir}>
                    Sim, excluir
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setConfirmandoExclusao(false)}>
                    Não
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="danger" onClick={() => setConfirmandoExclusao(true)}>
                  Excluir
                </Button>
              ))}
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
