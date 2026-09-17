"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { where } from "firebase/firestore";
import { Plus, Repeat } from "lucide-react";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { EventoModal } from "@/components/calendario/EventoModal";
import { RecorrenciaModal } from "@/components/calendario/RecorrenciaModal";
import { OcorrenciaModal } from "@/components/calendario/OcorrenciaModal";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { formatarHoras } from "@/lib/horas";
import { STATUS_HORA_CONFIG, statusEfetivo } from "@/lib/statusHora";
import type { Cliente, EventoCalendario, Projeto, Recurso } from "@/types";

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function CalendarioPageContent() {
  const { usuario } = useAuth();
  const souConsultor = usuario?.perfil === "consultor";
  const meuRecursoId = usuario?.recursoId ?? null;

  const { data: eventos } = useCollection<EventoCalendario>(
    "eventosCalendario",
    souConsultor ? [where("recursoId", "==", meuRecursoId ?? "")] : [],
    !souConsultor || !!meuRecursoId
  );
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const { data: recursos } = useCollection<Recurso>("recursos");

  const [mesBase, setMesBase] = useState(() => startOfMonth(new Date()));
  const [filtroRecursos, setFiltroRecursos] = useState<string[]>([]);
  const [modalInfo, setModalInfo] = useState<{
    data: string;
    horaInicioPadrao: string;
    horaFimPadrao: string;
    evento: EventoCalendario | null;
  } | null>(null);
  const [recorrenciaAberta, setRecorrenciaAberta] = useState(false);
  const [ocorrenciaSelecionada, setOcorrenciaSelecionada] = useState<EventoCalendario | null>(null);

  const dias = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mesBase), { weekStartsOn: 1 });
    const fim = endOfWeek(endOfMonth(mesBase), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: inicio, end: fim });
  }, [mesBase]);

  const recursosVisiveis =
    filtroRecursos.length === 0 ? recursos : recursos.filter((r) => filtroRecursos.includes(r.id));

  function toggleFiltro(id: string) {
    setFiltroRecursos((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  function eventosDoDia(diaISO: string) {
    return eventos
      .filter(
        (e) => !e.retroativo && e.data === diaISO && recursosVisiveis.some((r) => r.id === e.recursoId)
      )
      .sort((a, b) => (a.horaInicio ?? "").localeCompare(b.horaInicio ?? ""));
  }

  function abrirEvento(ev: EventoCalendario, diaISO: string) {
    if (ev.origem === "recorrencia" && statusEfetivo(ev) === "previsto") {
      setOcorrenciaSelecionada(ev);
      return;
    }
    setModalInfo({ data: diaISO, horaInicioPadrao: ev.horaInicio, horaFimPadrao: ev.horaFim, evento: ev });
  }

  function abrirNovo(diaISO: string, horaInicio: string, horaFim: string) {
    setModalInfo({ data: diaISO, horaInicioPadrao: horaInicio, horaFimPadrao: horaFim, evento: null });
  }

  const mesLabel = format(mesBase, "MMMM yyyy", { locale: ptBR });
  const hojeISO = format(new Date(), "yyyy-MM-dd");

  const horasNoMes = useMemo(() => {
    const prefixo = format(mesBase, "yyyy-MM");
    return eventos
      .filter(
        (e) =>
          !e.retroativo &&
          e.data.startsWith(prefixo) &&
          recursosVisiveis.some((r) => r.id === e.recursoId) &&
          statusEfetivo(e) === "aprovado"
      )
      .reduce((acc, e) => acc + e.totalHoras, 0);
  }, [eventos, mesBase, recursosVisiveis]);

  if (souConsultor && !meuRecursoId) {
    return (
      <p className="rounded-2xl border border-dashed border-brand-border bg-white p-6 text-sm text-brand-muted">
        Seu usuário ainda não está vinculado a um recurso. Peça a um administrador para vincular seu
        usuário a um recurso em Cadastros → Usuários.
      </p>
    );
  }

  return (
    <div className="flex gap-5">
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">
            {souConsultor ? "Meu calendário" : "Calendário de atendimento"}
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center overflow-hidden rounded-[10px] border border-brand-border bg-white">
              <button
                onClick={() => setMesBase((m) => addMonths(m, -1))}
                className="px-3.5 py-2 text-[15px] text-brand-muted hover:bg-brand-hover"
              >
                ‹
              </button>
              <div className="border-x border-brand-border px-3.5 py-2 text-[13.5px] font-bold text-brand-navy-2 capitalize">
                {mesLabel}
              </div>
              <button
                onClick={() => setMesBase((m) => addMonths(m, 1))}
                className="px-3.5 py-2 text-[15px] text-brand-muted hover:bg-brand-hover"
              >
                ›
              </button>
            </div>
            <Button variant="secondary" onClick={() => setRecorrenciaAberta(true)}>
              <Repeat size={16} /> Agenda fixa
            </Button>
            <Button onClick={() => abrirNovo(hojeISO, "08:00", "12:00")}>
              <Plus size={16} /> Novo lançamento
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
          <div className="grid grid-cols-7 border-b border-brand-border bg-brand-hover text-center">
            {DIAS_SEMANA.map((d) => (
              <div
                key={d}
                className="border-r border-brand-border py-2.5 text-[11px] font-bold tracking-[.1em] text-brand-faint uppercase last:border-r-0"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {dias.map((d) => {
              const diaISO = format(d, "yyyy-MM-dd");
              const eventosDia = eventosDoDia(diaISO);
              const foraDoMes = !isSameMonth(d, mesBase);
              return (
                <div
                  key={diaISO}
                  className={`group flex min-h-[112px] flex-col gap-1 border-r border-b border-brand-border-soft p-1.5 last:border-r-0 ${
                    foraDoMes ? "bg-brand-hover/40" : "bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                        isToday(d)
                          ? "bg-brand-accent text-white"
                          : foraDoMes
                            ? "text-brand-faint"
                            : "text-brand-navy-2"
                      }`}
                    >
                      {format(d, "d")}
                    </span>
                    <button
                      onClick={() => abrirNovo(diaISO, "08:00", "12:00")}
                      className="rounded p-0.5 text-brand-faint opacity-0 group-hover:opacity-100 hover:bg-brand-accent-soft hover:text-brand-accent"
                      aria-label="Novo lançamento"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-y-auto">
                    {eventosDia.map((ev) => {
                      const recurso = recursos.find((r) => r.id === ev.recursoId);
                      const projeto = projetos.find((p) => p.id === ev.projetoId);
                      const cliente = clientes.find((c) => c.id === projeto?.clienteId);
                      const statusEv = statusEfetivo(ev);
                      const cfg = STATUS_HORA_CONFIG[statusEv];
                      return (
                        <button
                          key={ev.id}
                          onClick={() => abrirEvento(ev, diaISO)}
                          style={{ backgroundColor: cfg.bg, color: cfg.text }}
                          className={`flex items-center gap-1 truncate rounded px-1.5 py-[3px] text-left text-[10.5px] leading-tight hover:brightness-95 ${
                            statusEv === "cancelado" ? "line-through" : ""
                          } ${statusEv === "previsto" ? "border border-dashed border-brand-border" : ""}`}
                          title={`${ev.descricao ? ev.descricao + " · " : ""}${cfg.label}`}
                        >
                          {ev.origem === "recorrencia" && <Repeat size={9} className="shrink-0" />}
                          <span className="truncate">
                            <strong>{ev.horaInicio}</strong>{" "}
                            {!souConsultor && recurso ? `${recurso.nomeCompleto.split(" ")[0]} · ` : ""}
                            {nomeExibicaoCliente(cliente)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="flex w-[260px] shrink-0 flex-col gap-4">
        {!souConsultor && (
          <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-card">
            <p className="mb-2.5 text-[11px] font-bold tracking-[.1em] text-brand-faint uppercase">
              Recursos
            </p>
            <div className="space-y-1.5">
              {recursos.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-[13px] text-brand-navy-2">
                  <input
                    type="checkbox"
                    checked={filtroRecursos.length === 0 || filtroRecursos.includes(r.id)}
                    onChange={() => toggleFiltro(r.id)}
                  />
                  {r.nomeCompleto}
                </label>
              ))}
              {recursos.length === 0 && (
                <p className="text-xs text-brand-faint">Nenhum recurso cadastrado.</p>
              )}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-card">
          <p className="mb-3 text-[11px] font-bold tracking-[.1em] text-brand-faint uppercase">
            Atalhos de hoje
          </p>
          <button
            onClick={() => abrirNovo(hojeISO, "08:00", "12:00")}
            className="mb-2 w-full rounded-[10px] border border-brand-border px-4 py-2.5 text-left text-[13.5px] font-semibold text-brand-navy-2 hover:bg-brand-hover"
          >
            + Manhã · 08h–12h
          </button>
          <button
            onClick={() => abrirNovo(hojeISO, "13:00", "17:00")}
            className="w-full rounded-[10px] border border-brand-border px-4 py-2.5 text-left text-[13.5px] font-semibold text-brand-navy-2 hover:bg-brand-hover"
          >
            + Tarde · 13h–17h
          </button>
        </div>

        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-card">
          <p className="mb-3 text-[11px] font-bold tracking-[.1em] text-brand-faint uppercase">Legenda</p>
          <div className="flex flex-col gap-2.5 text-[12.5px] text-brand-muted">
            {(Object.keys(STATUS_HORA_CONFIG) as Array<keyof typeof STATUS_HORA_CONFIG>).map((s) => (
              <div key={s} className="flex items-center gap-2.5">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded"
                  style={{ backgroundColor: STATUS_HORA_CONFIG[s].bg }}
                />
                {STATUS_HORA_CONFIG[s].label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-brand-navy p-5 text-white shadow-navy">
          <div
            className="pointer-events-none absolute -top-[90px] -right-[70px] h-[220px] w-[220px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(47,111,228,.5) 0%, rgba(47,111,228,0) 70%)" }}
          />
          <p className="relative mb-2 text-[11px] font-bold tracking-[.1em] text-white/55 uppercase">
            Horas no mês
          </p>
          <p className="relative text-[32px] leading-none font-extrabold tracking-[-0.03em]">
            {formatarHoras(horasNoMes)}
          </p>
        </div>
      </aside>

      {modalInfo && usuario && (
        <EventoModal
          aberto
          onClose={() => setModalInfo(null)}
          data={modalInfo.data}
          horaInicioPadrao={modalInfo.horaInicioPadrao}
          horaFimPadrao={modalInfo.horaFimPadrao}
          eventoEditando={modalInfo.evento}
          projetos={projetos}
          clientes={clientes}
          recursos={recursos}
          usuario={usuario}
        />
      )}

      {usuario && (
        <RecorrenciaModal
          aberto={recorrenciaAberta}
          onClose={() => setRecorrenciaAberta(false)}
          projetos={projetos}
          clientes={clientes}
          recursos={recursos}
          usuario={usuario}
        />
      )}

      {usuario && (
        <OcorrenciaModal
          ocorrencia={ocorrenciaSelecionada}
          onClose={() => setOcorrenciaSelecionada(null)}
          projetos={projetos}
          clientes={clientes}
          recursos={recursos}
          usuario={usuario}
        />
      )}
    </div>
  );
}

export default function CalendarioPage() {
  return (
    <ProtectedPage perfis={["administrador", "coordenador", "consultor"]}>
      <CalendarioPageContent />
    </ProtectedPage>
  );
}
