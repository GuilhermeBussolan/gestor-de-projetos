"use client";

import { useMemo, useState } from "react";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { where } from "firebase/firestore";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { EventoModal } from "@/components/calendario/EventoModal";
import { useAuth } from "@/contexts/AuthContext";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { formatarHoras } from "@/lib/horas";
import type { Cliente, EventoCalendario, Projeto, Recurso } from "@/types";

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

  const [semanaBase, setSemanaBase] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [filtroRecursos, setFiltroRecursos] = useState<string[]>([]);
  const [modalInfo, setModalInfo] = useState<{
    data: string;
    horaInicioPadrao: string;
    horaFimPadrao: string;
    evento: EventoCalendario | null;
  } | null>(null);

  const dias = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(semanaBase, i)),
    [semanaBase]
  );

  const recursosVisiveis =
    filtroRecursos.length === 0 ? recursos : recursos.filter((r) => filtroRecursos.includes(r.id));

  function toggleFiltro(id: string) {
    setFiltroRecursos((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  function eventosDoDia(diaISO: string) {
    return eventos
      .filter((e) => e.data === diaISO && recursosVisiveis.some((r) => r.id === e.recursoId))
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }

  if (souConsultor && !meuRecursoId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Seu usuário ainda não está vinculado a um recurso. Peça a um administrador para vincular seu
        usuário a um recurso em Cadastros → Usuários.
      </p>
    );
  }

  return (
    <div className="flex gap-6">
      {!souConsultor && (
        <aside className="w-56 shrink-0">
          <p className="mb-2 text-sm font-semibold text-slate-700">Recursos</p>
          <div className="space-y-1 rounded-md border border-slate-200 bg-white p-3">
            {recursos.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={filtroRecursos.length === 0 || filtroRecursos.includes(r.id)}
                  onChange={() => toggleFiltro(r.id)}
                />
                {r.nomeCompleto}
              </label>
            ))}
            {recursos.length === 0 && (
              <p className="text-xs text-slate-400">Nenhum recurso cadastrado.</p>
            )}
          </div>
        </aside>
      )}

      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">
            {souConsultor ? "Meu calendário" : "Calendário de atendimento"}
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSemanaBase((s) => addWeeks(s, -1))}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              ← Semana anterior
            </button>
            <span className="text-sm text-slate-600">
              {format(dias[0], "dd/MM")} – {format(dias[4], "dd/MM/yyyy")}
            </span>
            <button
              onClick={() => setSemanaBase((s) => addWeeks(s, 1))}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              Próxima semana →
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="grid grid-cols-5 border-b border-slate-200 bg-slate-50 text-center text-sm font-semibold text-slate-700">
            {dias.map((d) => (
              <div key={d.toISOString()} className="border-r border-slate-200 py-2 last:border-r-0">
                {format(d, "EEEE", { locale: ptBR })}
                <div className="text-xs font-normal text-slate-400">{format(d, "dd/MM")}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-5">
            {dias.map((d) => {
              const diaISO = format(d, "yyyy-MM-dd");
              const eventosDia = eventosDoDia(diaISO);
              return (
                <div
                  key={diaISO}
                  className="min-h-[220px] space-y-1 border-r border-slate-100 p-2 last:border-r-0"
                >
                  {eventosDia.map((ev) => {
                    const recurso = recursos.find((r) => r.id === ev.recursoId);
                    const projeto = projetos.find((p) => p.id === ev.projetoId);
                    const cliente = clientes.find((c) => c.id === projeto?.clienteId);
                    return (
                      <button
                        key={ev.id}
                        onClick={() =>
                          setModalInfo({
                            data: diaISO,
                            horaInicioPadrao: ev.horaInicio,
                            horaFimPadrao: ev.horaFim,
                            evento: ev,
                          })
                        }
                        className="block w-full truncate rounded bg-sky-100 px-2 py-1 text-left text-xs text-sky-800 hover:bg-sky-200"
                        title={ev.descricao}
                      >
                        <span className="font-semibold">
                          {ev.horaInicio}–{ev.horaFim} ({formatarHoras(ev.totalHoras)})
                        </span>
                        <br />
                        {!souConsultor && `${recurso?.nomeCompleto} · `}
                        {nomeExibicaoCliente(cliente)}
                      </button>
                    );
                  })}
                  <div className="flex gap-1 pt-1">
                    <button
                      onClick={() =>
                        setModalInfo({
                          data: diaISO,
                          horaInicioPadrao: "08:00",
                          horaFimPadrao: "12:00",
                          evento: null,
                        })
                      }
                      className="flex-1 rounded border border-dashed border-slate-300 py-1 text-[11px] text-slate-400 hover:border-sky-400 hover:text-sky-600"
                    >
                      + manhã
                    </button>
                    <button
                      onClick={() =>
                        setModalInfo({
                          data: diaISO,
                          horaInicioPadrao: "13:00",
                          horaFimPadrao: "17:00",
                          evento: null,
                        })
                      }
                      className="flex-1 rounded border border-dashed border-slate-300 py-1 text-[11px] text-slate-400 hover:border-sky-400 hover:text-sky-600"
                    >
                      + tarde
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

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
