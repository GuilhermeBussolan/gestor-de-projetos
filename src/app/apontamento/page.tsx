"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { deleteDoc, doc, where } from "firebase/firestore";
import { ChevronDown, ChevronUp, Upload } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { KpiCard, PainelVazio } from "@/components/ui/KpiCard";
import { Modal } from "@/components/ui/Modal";
import { ImportarHorasRetroativasModal } from "@/components/importacao/ImportarHorasRetroativasModal";
import { useAuth } from "@/contexts/AuthContext";
import { formatarHoras } from "@/lib/horas";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { STATUS_HORA_CONFIG, statusEfetivo } from "@/lib/statusHora";
import { aprovarHora, confirmarRealizado, rejeitarHora } from "@/lib/aprovacaoHoras";
import {
  montarRelatorio,
  exportarRelatorioWord,
  exportarRelatorioPdf,
} from "@/lib/relatorioApontamento";
import type { Cliente, EventoCalendario, Projeto, Recurso, StatusHora, Usuario } from "@/types";

function formatarDataBR(iso: string) {
  return iso.split("-").reverse().join("/");
}

function LinhaHora({
  ev,
  projetos,
  clientes,
  recursos,
  mostrarRecurso,
  colapsavel = false,
  children,
}: {
  ev: EventoCalendario;
  projetos: Projeto[];
  clientes: Cliente[];
  recursos: Recurso[];
  mostrarRecurso: boolean;
  colapsavel?: boolean;
  children?: React.ReactNode;
}) {
  const [expandido, setExpandido] = useState(false);
  const projeto = projetos.find((p) => p.id === ev.projetoId);
  const cliente = clientes.find((c) => c.id === projeto?.clienteId);
  const recurso = recursos.find((r) => r.id === ev.recursoId);
  const statusEv = statusEfetivo(ev);
  const cfg = STATUS_HORA_CONFIG[statusEv];
  const atividadesFeitas = (ev.atividadesRealizadas ?? [])
    .map((id) => projeto?.escopoAtividades?.find((a) => a.id === id)?.descricao)
    .filter((d): d is string => !!d);
  const temMotivo = statusEv === "rejeitado" && !!ev.motivoRejeicao;
  const temDetalhe = !!ev.descricao || atividadesFeitas.length > 0 || temMotivo;
  const mostrarDetalhe = !colapsavel || expandido;

  return (
    <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-brand-navy-2">{nomeExibicaoCliente(cliente)}</p>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold"
              style={{ backgroundColor: cfg.bg, color: cfg.text }}
            >
              {cfg.label}
            </span>
            <span className="rounded-full bg-brand-hover px-2.5 py-0.5 text-[10.5px] font-bold text-brand-faint">
              {ev.origem === "avulso" ? "Avulso" : "Recorrência"}
            </span>
            {ev.retroativo && (
              <span className="rounded-full bg-[#e8efff] px-2.5 py-0.5 text-[10.5px] font-bold text-[#2456b8]">
                Retroativo
              </span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] text-brand-muted">
            {formatarDataBR(ev.data)} · {ev.horaInicio}–{ev.horaFim}
            {mostrarRecurso && recurso ? ` · ${recurso.nomeCompleto}` : ""}
            {!colapsavel && ev.descricao ? ` · ${ev.descricao}` : ""}
          </p>
          {mostrarDetalhe && (
            <>
              {colapsavel && ev.descricao && (
                <p className="mt-2 text-[12.5px] text-brand-muted">{ev.descricao}</p>
              )}
              {temMotivo && (
                <p className="mt-2 rounded-md bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[#b5392a]">
                  <strong>Motivo da rejeição:</strong> {ev.motivoRejeicao}
                </p>
              )}
              {atividadesFeitas.length > 0 && (
                <div className="mt-2 rounded-md bg-brand-hover px-3 py-2 text-[12.5px] text-brand-muted">
                  <strong className="text-brand-navy-2">Atividades do escopo realizadas:</strong>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {atividadesFeitas.map((nome, i) => (
                      <li key={i}>{nome}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[15px] font-extrabold text-brand-navy-2">
            {formatarHoras(ev.totalHoras)}
          </span>
          {colapsavel && temDetalhe && (
            <button
              type="button"
              onClick={() => setExpandido((v) => !v)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold text-brand-accent hover:bg-brand-accent-soft"
            >
              {expandido ? "Ocultar" : "Detalhes"}
              {expandido ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

function AbaPrevistas({
  usuario,
  eventos,
  projetos,
  clientes,
  recursos,
}: {
  usuario: Usuario;
  eventos: EventoCalendario[];
  projetos: Projeto[];
  clientes: Cliente[];
  recursos: Recurso[];
}) {
  const souConsultor = usuario.perfil === "consultor";
  const [filtroProjetoId, setFiltroProjetoId] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"" | StatusHora>("");
  const [filtroMes, setFiltroMes] = useState("");
  const [ordenacao, setOrdenacao] = useState<"desc" | "asc">("desc");

  const eventosPendentes = useMemo(
    () => eventos.filter((e) => ["previsto", "aguardando_aprovacao", "rejeitado"].includes(statusEfetivo(e))),
    [eventos]
  );

  const projetosComPendencia = useMemo(() => {
    const ids = new Set(eventosPendentes.map((e) => e.projetoId));
    return projetos.filter((p) => ids.has(p.id));
  }, [eventosPendentes, projetos]);

  const previstas = useMemo(() => {
    let lista = eventosPendentes;
    if (filtroProjetoId) lista = lista.filter((e) => e.projetoId === filtroProjetoId);
    if (filtroStatus) lista = lista.filter((e) => statusEfetivo(e) === filtroStatus);
    if (filtroMes) lista = lista.filter((e) => e.data.startsWith(filtroMes));
    return [...lista].sort((a, b) => {
      const chaveA = `${a.data} ${a.horaInicio ?? ""}`;
      const chaveB = `${b.data} ${b.horaInicio ?? ""}`;
      const cmp = chaveA < chaveB ? -1 : chaveA > chaveB ? 1 : 0;
      return ordenacao === "asc" ? cmp : -cmp;
    });
  }, [eventosPendentes, filtroProjetoId, filtroStatus, filtroMes, ordenacao]);

  async function excluirPendente(ev: EventoCalendario) {
    if (!confirm("Excluir este lançamento? Ele ainda não foi aprovado — essa ação não pode ser desfeita.")) return;
    await deleteDoc(doc(db, "eventosCalendario", ev.id));
  }

  return (
    <div>
      <p className="mb-4 text-sm text-brand-muted">
        {souConsultor
          ? "Horas que você lançou no Calendário, aguardando sua confirmação ou a aprovação do coordenador."
          : "Horas que os consultores lançaram, ainda não aprovadas — aprovação fica na aba \"Aprovação de horas\"."}
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <FormRow label="Cliente / projeto">
          <Select value={filtroProjetoId} onChange={(e) => setFiltroProjetoId(e.target.value)} className="w-56">
            <option value="">Todos</option>
            {projetosComPendencia.map((p) => {
              const cliente = clientes.find((c) => c.id === p.clienteId);
              return (
                <option key={p.id} value={p.id}>
                  {nomeExibicaoCliente(cliente)} — {p.codigoProposta}
                </option>
              );
            })}
          </Select>
        </FormRow>
        <FormRow label="Status">
          <Select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as "" | StatusHora)}
            className="w-52"
          >
            <option value="">Todos</option>
            <option value="previsto">{STATUS_HORA_CONFIG.previsto.label} (a confirmar)</option>
            <option value="aguardando_aprovacao">{STATUS_HORA_CONFIG.aguardando_aprovacao.label}</option>
            <option value="rejeitado">{STATUS_HORA_CONFIG.rejeitado.label}</option>
          </Select>
        </FormRow>
        <FormRow label="Mês">
          <Input
            type="month"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="w-40"
          />
        </FormRow>
        <FormRow label="Ordenar por data">
          <Select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value as "desc" | "asc")} className="w-48">
            <option value="desc">Mais recentes primeiro</option>
            <option value="asc">Mais antigas primeiro</option>
          </Select>
        </FormRow>
        {(filtroProjetoId || filtroStatus || filtroMes) && (
          <button
            type="button"
            onClick={() => {
              setFiltroProjetoId("");
              setFiltroStatus("");
              setFiltroMes("");
            }}
            className="mb-2.5 text-[12.5px] font-semibold text-brand-accent hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {previstas.map((ev) => {
          const souDono = ev.recursoId === usuario.recursoId;
          const statusEv = statusEfetivo(ev);
          return (
            <LinhaHora
              key={ev.id}
              ev={ev}
              projetos={projetos}
              clientes={clientes}
              recursos={recursos}
              mostrarRecurso={!souConsultor}
            >
              {souConsultor && souDono && statusEv === "previsto" && ev.origem === "avulso" && (
                <>
                  <Button onClick={() => confirmarRealizado(ev.id)}>Confirmar realizado</Button>
                  <Link href="/calendario" className="text-sm font-semibold text-brand-accent hover:underline">
                    Editar no calendário
                  </Link>
                </>
              )}
              {souConsultor &&
                souDono &&
                statusEv === "previsto" &&
                ev.origem === "recorrencia" && (
                  <Link href="/calendario" className="text-sm font-semibold text-brand-accent hover:underline">
                    Confirmar no calendário
                  </Link>
                )}
              {souConsultor && souDono && statusEv === "rejeitado" && (
                <Link href="/calendario" className="text-sm font-semibold text-brand-accent hover:underline">
                  Ajustar no calendário
                </Link>
              )}
              {souConsultor && souDono && (
                <Button
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => excluirPendente(ev)}
                >
                  Excluir
                </Button>
              )}
            </LinhaHora>
          );
        })}
        {previstas.length === 0 && (
          <p className="rounded-2xl border border-dashed border-brand-border bg-white p-8 text-center text-brand-faint">
            {eventosPendentes.length === 0
              ? "Nada por aqui — tudo já confirmado ou aprovado."
              : "Nenhum lançamento encontrado para esse filtro."}
          </p>
        )}
      </div>
    </div>
  );
}

function AbaAprovacao({
  usuario,
  eventos,
  projetos,
  clientes,
  recursos,
}: {
  usuario: Usuario;
  eventos: EventoCalendario[];
  projetos: Projeto[];
  clientes: Cliente[];
  recursos: Recurso[];
}) {
  const [rejeitando, setRejeitando] = useState<EventoCalendario | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const aguardando = useMemo(
    () =>
      [...eventos]
        .filter((e) => statusEfetivo(e) === "aguardando_aprovacao")
        .sort((a, b) => (a.data === b.data ? (a.horaInicio ?? "").localeCompare(b.horaInicio ?? "") : a.data < b.data ? 1 : -1)),
    [eventos]
  );

  async function confirmarRejeicao(e: React.FormEvent) {
    e.preventDefault();
    if (!rejeitando || !motivo.trim()) return;
    setSalvando(true);
    try {
      await rejeitarHora(rejeitando.id, motivo.trim(), usuario);
      setRejeitando(null);
      setMotivo("");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-brand-muted">
        Horas que os consultores já confirmaram como realizadas, aguardando sua decisão.
      </p>
      <div className="flex flex-col gap-3">
        {aguardando.map((ev) => (
          <LinhaHora
            key={ev.id}
            ev={ev}
            projetos={projetos}
            clientes={clientes}
            recursos={recursos}
            mostrarRecurso
          >
            <Button onClick={() => aprovarHora(ev.id, usuario)}>Aprovar</Button>
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={() => {
                setRejeitando(ev);
                setMotivo("");
              }}
            >
              Rejeitar
            </Button>
          </LinhaHora>
        ))}
        {aguardando.length === 0 && (
          <p className="rounded-2xl border border-dashed border-brand-border bg-white p-8 text-center text-brand-faint">
            Nenhuma hora aguardando aprovação.
          </p>
        )}
      </div>

      <Modal open={!!rejeitando} onClose={() => setRejeitando(null)} title="Rejeitar horas">
        <form onSubmit={confirmarRejeicao} className="space-y-4">
          <FormRow label="Motivo da rejeição (obrigatório)">
            <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} required autoFocus />
          </FormRow>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setRejeitando(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={salvando || !motivo.trim()}>
              {salvando ? "Rejeitando..." : "Rejeitar horas"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function AbaAprovadas({
  usuario,
  eventos,
  projetos,
  clientes,
  recursos,
}: {
  usuario: Usuario;
  eventos: EventoCalendario[];
  projetos: Projeto[];
  clientes: Cliente[];
  recursos: Recurso[];
}) {
  const souConsultor = usuario.perfil === "consultor";
  const [recursoFiltro, setRecursoFiltro] = useState("");
  const [filtroProjetoId, setFiltroProjetoId] = useState("");
  const [filtroMes, setFiltroMes] = useState("");
  const [ordenacao, setOrdenacao] = useState<"desc" | "asc">("desc");
  const [kpiAberto, setKpiAberto] = useState<"horas" | "dias" | "projetos" | null>(null);

  const aprovadasTodas = useMemo(
    () =>
      [...eventos]
        .filter((e) => statusEfetivo(e) === "aprovado")
        .sort((a, b) => (a.data === b.data ? (a.horaInicio ?? "").localeCompare(b.horaInicio ?? "") : a.data < b.data ? 1 : -1)),
    [eventos]
  );

  const projetosComAprovadas = useMemo(() => {
    const ids = new Set(aprovadasTodas.map((e) => e.projetoId));
    return projetos.filter((p) => ids.has(p.id));
  }, [aprovadasTodas, projetos]);

  const aprovadas = useMemo(() => {
    let lista = aprovadasTodas;
    if (filtroProjetoId) lista = lista.filter((e) => e.projetoId === filtroProjetoId);
    if (filtroMes) lista = lista.filter((e) => e.data.startsWith(filtroMes));
    return [...lista].sort((a, b) => {
      const chaveA = `${a.data} ${a.horaInicio ?? ""}`;
      const chaveB = `${b.data} ${b.horaInicio ?? ""}`;
      const cmp = chaveA < chaveB ? -1 : chaveA > chaveB ? 1 : 0;
      return ordenacao === "asc" ? cmp : -cmp;
    });
  }, [aprovadasTodas, filtroProjetoId, filtroMes, ordenacao]);

  const totalHoras = aprovadasTodas.reduce((acc, e) => acc + e.totalHoras, 0);
  const diasLancados = new Set(aprovadasTodas.map((e) => e.data)).size;
  const projetosAtendidos = new Set(aprovadasTodas.map((e) => e.projetoId)).size;

  const horasPorCliente = useMemo(() => {
    const mapa = new Map<string, number>();
    aprovadasTodas.forEach((e) => {
      const projeto = projetos.find((p) => p.id === e.projetoId);
      if (!projeto) return;
      mapa.set(projeto.clienteId, (mapa.get(projeto.clienteId) ?? 0) + e.totalHoras);
    });
    return [...mapa.entries()]
      .map(([clienteId, horas]) => ({
        clienteId,
        nome: nomeExibicaoCliente(clientes.find((c) => c.id === clienteId)),
        horas,
      }))
      .sort((a, b) => b.horas - a.horas);
  }, [aprovadasTodas, projetos, clientes]);

  const horasPorDia = useMemo(() => {
    const mapa = new Map<string, number>();
    aprovadasTodas.forEach((e) => mapa.set(e.data, (mapa.get(e.data) ?? 0) + e.totalHoras));
    return [...mapa.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [aprovadasTodas]);

  const relatorio = useMemo(
    () => montarRelatorio(aprovadasTodas, recursos, projetos, clientes, recursoFiltro || undefined),
    [aprovadasTodas, recursos, projetos, clientes, recursoFiltro]
  );

  return (
    <div>
      <p className="mb-5 text-sm text-brand-muted">
        Dados oficiais — só horas já aprovadas pelo coordenador entram aqui e contam nos cálculos do
        projeto.
      </p>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total de horas"
          valor={formatarHoras(totalHoras)}
          nota="todas as horas aprovadas"
          aberto={kpiAberto === "horas"}
          onToggle={() => setKpiAberto((v) => (v === "horas" ? null : "horas"))}
        >
          <p className="mb-2 px-1 text-[11px] font-bold tracking-[.08em] text-brand-faint uppercase">
            Horas aprovadas por cliente
          </p>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {horasPorCliente.map((h) => (
              <div
                key={h.clienteId}
                className="flex items-center justify-between gap-2 px-2 py-1.5 text-[12.5px] text-brand-navy-2"
              >
                <span className="truncate">{h.nome}</span>
                <span className="shrink-0 font-bold">{formatarHoras(h.horas)}</span>
              </div>
            ))}
            {horasPorCliente.length === 0 && <PainelVazio />}
          </div>
        </KpiCard>

        <KpiCard
          label="Dias com lançamento"
          valor={String(diasLancados)}
          nota="dias distintos com horas aprovadas"
          aberto={kpiAberto === "dias"}
          onToggle={() => setKpiAberto((v) => (v === "dias" ? null : "dias"))}
        >
          <p className="mb-2 px-1 text-[11px] font-bold tracking-[.08em] text-brand-faint uppercase">
            Horas aprovadas por dia
          </p>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {horasPorDia.map(([data, horas]) => (
              <div
                key={data}
                className="flex items-center justify-between gap-2 px-2 py-1.5 text-[12.5px] text-brand-navy-2"
              >
                <span className="truncate">{formatarDataBR(data)}</span>
                <span className="shrink-0 font-bold">{formatarHoras(horas)}</span>
              </div>
            ))}
            {horasPorDia.length === 0 && <PainelVazio />}
          </div>
        </KpiCard>

        <KpiCard
          label="Projetos atendidos"
          valor={String(projetosAtendidos)}
          nota="projetos com horas aprovadas"
          aberto={kpiAberto === "projetos"}
          onToggle={() => setKpiAberto((v) => (v === "projetos" ? null : "projetos"))}
        >
          <p className="mb-2 px-1 text-[11px] font-bold tracking-[.08em] text-brand-faint uppercase">
            Projetos atendidos
          </p>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {projetosComAprovadas.map((p) => {
              const cliente = nomeExibicaoCliente(clientes.find((c) => c.id === p.clienteId));
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 text-[12.5px] text-brand-navy-2"
                >
                  <span className="truncate">{cliente}</span>
                  <span className="shrink-0 text-[11px] text-brand-faint">{p.codigoProposta}</span>
                </div>
              );
            })}
            {projetosComAprovadas.length === 0 && <PainelVazio />}
          </div>
        </KpiCard>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <FormRow label="Cliente / projeto">
          <Select value={filtroProjetoId} onChange={(e) => setFiltroProjetoId(e.target.value)} className="w-56">
            <option value="">Todos</option>
            {projetosComAprovadas.map((p) => {
              const cliente = clientes.find((c) => c.id === p.clienteId);
              return (
                <option key={p.id} value={p.id}>
                  {nomeExibicaoCliente(cliente)} — {p.codigoProposta}
                </option>
              );
            })}
          </Select>
        </FormRow>
        <FormRow label="Mês">
          <Input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-40" />
        </FormRow>
        <FormRow label="Ordenar por data">
          <Select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value as "desc" | "asc")} className="w-48">
            <option value="desc">Mais recentes primeiro</option>
            <option value="asc">Mais antigas primeiro</option>
          </Select>
        </FormRow>
        {(filtroProjetoId || filtroMes) && (
          <button
            type="button"
            onClick={() => {
              setFiltroProjetoId("");
              setFiltroMes("");
            }}
            className="mb-2.5 text-[12.5px] font-semibold text-brand-accent hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {aprovadas.map((ev) => (
          <LinhaHora
            key={ev.id}
            ev={ev}
            projetos={projetos}
            clientes={clientes}
            recursos={recursos}
            mostrarRecurso={!souConsultor}
            colapsavel
          />
        ))}
        {aprovadas.length === 0 && (
          <p className="rounded-2xl border border-dashed border-brand-border bg-white p-8 text-center text-brand-faint">
            {aprovadasTodas.length === 0 ? "Nenhuma hora aprovada ainda." : "Nenhum lançamento encontrado para esse filtro."}
          </p>
        )}
      </div>

      {usuario.perfil === "administrador" && (
        <div className="mt-11 border-t border-brand-border pt-8">
          <h2 className="mb-4 text-lg font-extrabold tracking-[-0.01em] text-brand-navy-2">
            Relatório analítico por recurso
          </h2>
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <FormRow label="Filtrar por recurso">
              <Select value={recursoFiltro} onChange={(e) => setRecursoFiltro(e.target.value)} className="w-56">
                <option value="">Todos os recursos</option>
                {recursos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nomeCompleto}
                  </option>
                ))}
              </Select>
            </FormRow>
            <Button
              variant="secondary"
              disabled={relatorio.length === 0}
              onClick={() => exportarRelatorioWord(relatorio)}
            >
              Exportar Word
            </Button>
            <Button
              variant="secondary"
              disabled={relatorio.length === 0}
              onClick={() => exportarRelatorioPdf(relatorio)}
            >
              Exportar PDF
            </Button>
          </div>

          <div className="space-y-4">
            {relatorio.map((r) => (
              <div key={r.recurso.id} className="rounded-2xl border border-brand-border bg-white p-5 shadow-card">
                <p className="text-[15px] font-extrabold tracking-[-0.01em] text-brand-navy-2">
                  {r.recurso.nomeCompleto} ({r.recurso.codigo})
                </p>
                <p className="mb-3.5 text-sm text-brand-muted">
                  Total: <strong className="text-brand-navy-2">{formatarHoras(r.totalHoras)}</strong> ·
                  Valor/hora:{" "}
                  {r.recurso.valorHora.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ·
                  Valor a repassar:{" "}
                  <strong className="text-brand-navy-2">
                    {r.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </strong>
                </p>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-brand-border-soft text-left text-[11px] font-bold tracking-[.08em] text-brand-faint uppercase">
                      <th className="py-2">Data</th>
                      <th className="py-2">Projeto</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.linhas.map((l, i) => (
                      <tr key={i} className="border-b border-brand-border-soft last:border-b-0">
                        <td className="py-2 text-brand-muted">{formatarDataBR(l.data)}</td>
                        <td className="py-2 text-brand-navy-2">{l.projeto}</td>
                        <td className="py-2 text-right font-bold text-brand-navy-2">
                          {formatarHoras(l.totalHoras)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {relatorio.length === 0 && (
              <p className="rounded-2xl border border-dashed border-brand-border bg-white p-6 text-center text-brand-faint">
                Nenhum lançamento encontrado para o filtro selecionado.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ABAS_BASE = [
  { id: "previstas", label: "Horas previstas" },
  { id: "aprovacao", label: "Aprovação de horas" },
  { id: "aprovadas", label: "Horas aprovadas" },
] as const;

type AbaId = (typeof ABAS_BASE)[number]["id"];

function ApontamentoPageContent() {
  const { usuario } = useAuth();
  const souConsultor = usuario?.perfil === "consultor";
  const podeAprovar = usuario?.perfil === "administrador" || usuario?.perfil === "coordenador";
  const meuRecursoId = usuario?.recursoId ?? null;

  const { data: eventos } = useCollection<EventoCalendario>(
    "eventosCalendario",
    souConsultor ? [where("recursoId", "==", meuRecursoId ?? "")] : [],
    !souConsultor || !!meuRecursoId
  );
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const { data: recursos } = useCollection<Recurso>("recursos");

  const abas = ABAS_BASE.filter((a) => a.id !== "aprovacao" || podeAprovar);
  const [aba, setAba] = useState<AbaId>("previstas");
  const [importarAberto, setImportarAberto] = useState(false);

  if (souConsultor && !meuRecursoId) {
    return (
      <p className="rounded-2xl border border-dashed border-brand-border bg-white p-6 text-sm text-brand-muted">
        Seu usuário ainda não está vinculado a um recurso. Peça a um administrador para vincular seu
        usuário a um recurso em Cadastros → Usuários.
      </p>
    );
  }

  if (!usuario) return null;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">
          Apontamento de horas
        </h1>
        {podeAprovar && (
          <Button variant="secondary" onClick={() => setImportarAberto(true)}>
            <Upload size={15} /> Importar horas retroativas
          </Button>
        )}
      </div>

      <div className="mb-6 inline-flex gap-1 rounded-[10px] bg-brand-accent-soft/60 p-[3px]">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`rounded-[8px] px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
              aba === a.id
                ? "bg-white text-brand-navy-2 shadow-[0_2px_6px_rgba(21,40,73,0.12)]"
                : "text-brand-faint hover:text-brand-muted"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === "previstas" && (
        <AbaPrevistas
          usuario={usuario}
          eventos={eventos}
          projetos={projetos}
          clientes={clientes}
          recursos={recursos}
        />
      )}
      {aba === "aprovacao" && podeAprovar && (
        <AbaAprovacao
          usuario={usuario}
          eventos={eventos}
          projetos={projetos}
          clientes={clientes}
          recursos={recursos}
        />
      )}
      {aba === "aprovadas" && (
        <AbaAprovadas
          usuario={usuario}
          eventos={eventos}
          projetos={projetos}
          clientes={clientes}
          recursos={recursos}
        />
      )}

      {podeAprovar && (
        <ImportarHorasRetroativasModal
          open={importarAberto}
          onClose={() => setImportarAberto(false)}
          recursos={recursos}
          projetos={projetos}
          clientes={clientes}
        />
      )}
    </div>
  );
}

export default function ApontamentoPage() {
  return (
    <ProtectedPage perfis={["administrador", "coordenador", "consultor"]}>
      <ApontamentoPageContent />
    </ProtectedPage>
  );
}
