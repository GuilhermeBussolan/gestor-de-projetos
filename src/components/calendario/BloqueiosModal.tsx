"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Lock, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select } from "@/components/ui/Field";
import {
  bloqueiosQueConflitam,
  horarioDoBloqueio,
  periodoDoBloqueio,
  podeCriarBloqueio,
  podeGerenciarBloqueio,
} from "@/lib/bloqueioAgenda";
import { diasDoIntervalo } from "@/lib/cronograma";
import { statusEfetivo } from "@/lib/statusHora";
import type { BloqueioAgenda, EventoCalendario, Recurso, Usuario } from "@/types";

const LIMITE_DIAS = 366;
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

type Rascunho = {
  recursoId: string;
  diaInteiro: boolean;
  dataInicio: string;
  dataFim: string;
  horaInicio: string;
  horaFim: string;
  motivo: string;
};

function rascunhoDe(b: BloqueioAgenda): Rascunho {
  return {
    recursoId: b.recursoId,
    diaInteiro: b.diaInteiro,
    dataInicio: b.dataInicio,
    dataFim: b.dataFim,
    horaInicio: b.horaInicio ?? "08:00",
    horaFim: b.horaFim ?? "12:00",
    motivo: b.motivo,
  };
}

/**
 * Bloqueios de agenda: lista os que o usuário enxerga e permite criar/editar/excluir. O consultor bloqueia a própria
 * agenda; o administrador bloqueia a de qualquer consultor. Não deixa criar um bloqueio por cima de lançamentos
 * que já existem (a agenda precisa estar livre no período).
 */
export function BloqueiosModal({
  aberto,
  onClose,
  usuario,
  recursos,
  bloqueios,
  eventos,
  dataInicial,
  editandoInicial,
}: {
  aberto: boolean;
  onClose: () => void;
  usuario: Usuario;
  recursos: Recurso[];
  /** Os bloqueios que o usuário pode ver (já filtrados pelas regras). */
  bloqueios: BloqueioAgenda[];
  /** Lançamentos do calendário, para impedir bloquear por cima de algo já lançado. */
  eventos: EventoCalendario[];
  dataInicial: string;
  /** Abre direto na edição de um bloqueio (clique no bloqueio do calendário). */
  editandoInicial?: BloqueioAgenda | null;
}) {
  const souAdmin = usuario.perfil === "administrador";
  const podeCriar = podeCriarBloqueio(usuario);
  const hojeISO = new Date().toISOString().slice(0, 10);

  const novoRascunho = (): Rascunho => ({
    recursoId: souAdmin ? "" : (usuario.recursoId ?? ""),
    diaInteiro: true,
    dataInicio: dataInicial,
    dataFim: dataInicial,
    horaInicio: "08:00",
    horaFim: "12:00",
    motivo: "",
  });

  const [editando, setEditando] = useState<BloqueioAgenda | null>(editandoInicial ?? null);
  const [form, setForm] = useState<Rascunho>(() => (editandoInicial ? rascunhoDe(editandoInicial) : novoRascunho()));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false);

  const nomeRecurso = (id: string) => recursos.find((r) => r.id === id)?.nomeCompleto ?? "Recurso removido";
  const recursosSelecionaveis = souAdmin ? recursos : recursos.filter((r) => r.id === usuario.recursoId);

  const ordenados = [...bloqueios].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio) || nomeRecurso(a.recursoId).localeCompare(nomeRecurso(b.recursoId)));
  const vigentes = ordenados.filter((b) => b.dataFim >= hojeISO);
  const anteriores = ordenados.filter((b) => b.dataFim < hojeISO).reverse();
  const lista = mostrarAnteriores ? [...vigentes, ...anteriores] : vigentes;

  function alterar<K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) {
    setForm((f) => {
      const novo = { ...f, [campo]: valor };
      // Ao mudar o início para depois do fim, o fim acompanha (bloqueio de um dia só).
      if (campo === "dataInicio" && typeof valor === "string" && novo.dataFim < valor) novo.dataFim = valor;
      return novo;
    });
    setErro("");
  }

  function editar(b: BloqueioAgenda) {
    setEditando(b);
    setForm(rascunhoDe(b));
    setErro("");
  }

  function cancelarEdicao() {
    setEditando(null);
    setForm(novoRascunho());
    setErro("");
  }

  /** Lançamentos que já existem dentro do período/horário do bloqueio. */
  function lancamentosNoPeriodo(r: Rascunho): EventoCalendario[] {
    const provisorio: BloqueioAgenda = {
      id: "",
      recursoId: r.recursoId,
      dataInicio: r.dataInicio,
      dataFim: r.dataFim,
      diaInteiro: r.diaInteiro,
      horaInicio: r.diaInteiro ? null : r.horaInicio,
      horaFim: r.diaInteiro ? null : r.horaFim,
      motivo: r.motivo,
      criadoPorUid: "",
      criadoPorNome: "",
      createdAt: 0,
    };
    return eventos
      .filter(
        (e) =>
          !e.retroativo &&
          statusEfetivo(e) !== "cancelado" &&
          bloqueiosQueConflitam([provisorio], e.recursoId, e.data, e.horaInicio, e.horaFim).length > 0
      )
      .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!form.recursoId) return setErro("Escolha o consultor.");
    if (!souAdmin && form.recursoId !== usuario.recursoId) return setErro("Você só pode bloquear a sua própria agenda.");
    if (!form.dataInicio || !form.dataFim) return setErro("Informe as datas do bloqueio.");
    if (form.dataFim < form.dataInicio) return setErro("A data final não pode ser anterior à inicial.");
    if (diasDoIntervalo(form.dataInicio, form.dataFim).length > LIMITE_DIAS) return setErro("Um bloqueio pode ter no máximo 1 ano.");
    if (!form.diaInteiro && form.horaFim <= form.horaInicio) return setErro("A hora final precisa ser depois da inicial.");
    if (!form.motivo.trim()) return setErro("Informe o motivo (ex.: férias, curso, consulta médica).");

    const conflitos = lancamentosNoPeriodo(form);
    if (conflitos.length > 0) {
      const exemplos = conflitos
        .slice(0, 3)
        .map((c) => `${dataBR(c.data)} ${c.horaInicio}–${c.horaFim}`)
        .join(", ");
      return setErro(
        `Já existe${conflitos.length === 1 ? "" : "m"} ${conflitos.length} lançamento${conflitos.length === 1 ? "" : "s"} nesse período (${exemplos}${
          conflitos.length > 3 ? "…" : ""
        }). Remova ou mova esses lançamentos antes de bloquear.`
      );
    }

    const dados = {
      recursoId: form.recursoId,
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      diaInteiro: form.diaInteiro,
      horaInicio: form.diaInteiro ? null : form.horaInicio,
      horaFim: form.diaInteiro ? null : form.horaFim,
      motivo: form.motivo.trim(),
    };
    setSalvando(true);
    try {
      if (editando) {
        await updateDoc(doc(db, "bloqueiosAgenda", editando.id), dados);
      } else {
        await addDoc(collection(db, "bloqueiosAgenda"), {
          ...dados,
          criadoPorUid: usuario.uid,
          criadoPorNome: usuario.nomeCompleto,
          createdAt: Date.now(),
        });
      }
      setEditando(null);
      setForm(novoRascunho());
    } catch (err) {
      console.error("Falha ao salvar bloqueio:", err);
      setErro("Não foi possível salvar o bloqueio. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(b: BloqueioAgenda) {
    try {
      await deleteDoc(doc(db, "bloqueiosAgenda", b.id));
      if (editando?.id === b.id) cancelarEdicao();
    } catch (err) {
      console.error("Falha ao excluir bloqueio:", err);
      setErro("Não foi possível excluir o bloqueio. Tente novamente.");
    } finally {
      setExcluindo(null);
    }
  }

  return (
    <Modal open={aberto} onClose={onClose} title="Bloqueios de agenda" wide>
      <div className="space-y-5">
        <p className="text-[13px] text-brand-muted">
          Durante um bloqueio não é possível lançar nenhum apontamento na agenda do consultor.{" "}
          {souAdmin
            ? "Como administrador, você pode bloquear a agenda de qualquer consultor."
            : podeCriar
              ? "Você pode bloquear a sua própria agenda; bloqueios feitos pelo administrador só ele remove."
              : "Somente consultores (na própria agenda) e administradores criam bloqueios."}
        </p>

        {podeCriar && (
          <form onSubmit={salvar} className="space-y-3 rounded-xl border border-brand-border bg-brand-hover/50 p-4">
            <p className="text-[13px] font-extrabold text-brand-navy-2">{editando ? "Editar bloqueio" : "Novo bloqueio"}</p>

            {souAdmin ? (
              <FormRow label="Consultor">
                <Select value={form.recursoId} onChange={(e) => alterar("recursoId", e.target.value)} required>
                  <option value="">Selecione...</option>
                  {recursosSelecionaveis.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nomeCompleto}
                    </option>
                  ))}
                </Select>
              </FormRow>
            ) : (
              <p className="text-sm text-brand-muted">
                Bloqueando a agenda de: <strong>{nomeRecurso(form.recursoId)}</strong>
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              {[
                { valor: true, titulo: "Dia inteiro", ajuda: "Um ou mais dias seguidos" },
                { valor: false, titulo: "Horário", ajuda: "Algumas horas (em cada dia do período)" },
              ].map((op) => {
                const ativo = form.diaInteiro === op.valor;
                return (
                  <button
                    key={op.titulo}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => alterar("diaInteiro", op.valor)}
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                      ativo ? "border-brand-accent bg-brand-accent-soft" : "border-brand-border bg-white hover:bg-brand-hover"
                    }`}
                  >
                    <span className={`block text-[13px] font-bold ${ativo ? "text-brand-accent" : "text-brand-navy-2"}`}>{op.titulo}</span>
                    <span className="block text-[11px] text-brand-muted">{op.ajuda}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormRow label="De">
                <Input type="date" value={form.dataInicio} onChange={(e) => alterar("dataInicio", e.target.value)} required />
              </FormRow>
              <FormRow label="Até">
                <Input type="date" value={form.dataFim} min={form.dataInicio} onChange={(e) => alterar("dataFim", e.target.value)} required />
              </FormRow>
            </div>

            {!form.diaInteiro && (
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Hora início">
                  <Input type="time" value={form.horaInicio} onChange={(e) => alterar("horaInicio", e.target.value)} required />
                </FormRow>
                <FormRow label="Hora fim">
                  <Input type="time" value={form.horaFim} onChange={(e) => alterar("horaFim", e.target.value)} required />
                </FormRow>
              </div>
            )}

            <FormRow label="Motivo">
              <Input
                value={form.motivo}
                onChange={(e) => alterar("motivo", e.target.value)}
                placeholder="Ex.: férias, curso, consulta médica"
                maxLength={120}
                required
              />
            </FormRow>

            {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

            <div className="flex justify-end gap-2">
              {editando && (
                <Button type="button" variant="secondary" onClick={cancelarEdicao}>
                  Cancelar edição
                </Button>
              )}
              <Button type="submit" disabled={salvando}>
                <Lock size={15} />
                {salvando ? "Salvando..." : editando ? "Salvar bloqueio" : "Bloquear agenda"}
              </Button>
            </div>
          </form>
        )}
        {!podeCriar && erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-[.1em] text-brand-faint uppercase">
              {mostrarAnteriores ? "Todos os bloqueios" : "Bloqueios atuais e futuros"}
            </p>
            {anteriores.length > 0 && (
              <button type="button" onClick={() => setMostrarAnteriores((v) => !v)} className="text-[12px] font-semibold text-brand-accent hover:underline">
                {mostrarAnteriores ? "Ocultar anteriores" : `Mostrar anteriores (${anteriores.length})`}
              </button>
            )}
          </div>
          <div className="divide-y divide-brand-border-soft overflow-hidden rounded-xl border border-brand-border">
            {lista.map((b) => {
              const gerencia = podeGerenciarBloqueio(usuario, b);
              return (
                <div key={b.id} className={`flex items-start gap-3 px-3.5 py-2.5 ${editando?.id === b.id ? "bg-brand-accent-soft/50" : ""}`}>
                  <Lock size={15} className="mt-0.5 shrink-0 text-[#6a7594]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-brand-navy-2">
                      {usuario.perfil !== "consultor" && `${nomeRecurso(b.recursoId)} · `}
                      {periodoDoBloqueio(b)} · {horarioDoBloqueio(b)}
                    </p>
                    <p className="truncate text-[12px] text-brand-muted">
                      {b.motivo} · criado por {b.criadoPorNome}
                    </p>
                  </div>
                  {gerencia &&
                    (excluindo === b.id ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-[12px] font-medium text-red-600">Excluir?</span>
                        <Button type="button" variant="danger" className="h-8 px-2.5 text-[12px]" onClick={() => excluir(b)}>
                          Sim
                        </Button>
                        <Button type="button" variant="secondary" className="h-8 px-2.5 text-[12px]" onClick={() => setExcluindo(null)}>
                          Não
                        </Button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => editar(b)}
                          className="rounded-md p-1.5 text-brand-muted hover:bg-brand-hover hover:text-brand-accent"
                          aria-label="Editar bloqueio"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExcluindo(b.id)}
                          className="rounded-md p-1.5 text-brand-muted hover:bg-[#fdeceb] hover:text-[#b5392a]"
                          aria-label="Excluir bloqueio"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                </div>
              );
            })}
            {lista.length === 0 && <p className="p-4 text-center text-[13px] text-brand-faint">Nenhum bloqueio {mostrarAnteriores ? "" : "atual ou futuro"}.</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
