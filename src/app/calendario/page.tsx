"use client";

import { useMemo, useState } from "react";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { EventoModal } from "@/components/calendario/EventoModal";
import { useAuth } from "@/contexts/AuthContext";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Cliente, EventoCalendario, Periodo, Projeto, Recurso } from "@/types";

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "manha", label: "Manhã" },
  { key: "tarde", label: "Tarde" },
];

function CalendarioPageContent() {
  const { usuario } = useAuth();
  const { data: eventos } = useCollection<EventoCalendario>("eventosCalendario", []);
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const { data: recursos } = useCollection<Recurso>("recursos");

  const consultores = recursos.filter((r) => r.tipo !== "coordenador");

  const [semanaBase, setSemanaBase] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [filtroConsultores, setFiltroConsultores] = useState<string[]>([]);
  const [modalInfo, setModalInfo] = useState<{
    data: string;
    periodo: Periodo;
    evento: EventoCalendario | null;
  } | null>(null);

  const podeEditar = usuario?.perfil === "administrador" || usuario?.perfil === "coordenador";

  const dias = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(semanaBase, i)),
    [semanaBase]
  );

  const consultoresVisiveis =
    filtroConsultores.length === 0
      ? consultores
      : consultores.filter((c) => filtroConsultores.includes(c.id));

  function toggleFiltro(id: string) {
    setFiltroConsultores((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  function eventosDoSlot(diaISO: string, periodo: Periodo) {
    return eventos.filter(
      (e) =>
        e.data === diaISO &&
        e.periodo === periodo &&
        consultoresVisiveis.some((c) => c.id === e.recursoId)
    );
  }

  return (
    <div className="flex gap-6">
      <aside className="w-56 shrink-0">
        <p className="mb-2 text-sm font-semibold text-slate-700">Consultores</p>
        <div className="space-y-1 rounded-md border border-slate-200 bg-white p-3">
          {consultores.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filtroConsultores.length === 0 || filtroConsultores.includes(c.id)}
                onChange={() => toggleFiltro(c.id)}
              />
              {c.nomeCompleto}
            </label>
          ))}
          {consultores.length === 0 && (
            <p className="text-xs text-slate-400">Nenhum consultor cadastrado.</p>
          )}
        </div>
      </aside>

      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Calendário de atendimento</h1>
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

          {PERIODOS.map((periodo) => (
            <div key={periodo.key} className="grid grid-cols-5 border-b border-slate-100 last:border-b-0">
              {dias.map((d) => {
                const diaISO = format(d, "yyyy-MM-dd");
                const eventosSlot = eventosDoSlot(diaISO, periodo.key);
                return (
                  <div
                    key={diaISO + periodo.key}
                    className="min-h-[110px] border-r border-slate-100 p-2 last:border-r-0"
                  >
                    <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
                      {periodo.label}
                    </p>
                    <div className="space-y-1">
                      {eventosSlot.map((ev) => {
                        const recurso = recursos.find((r) => r.id === ev.recursoId);
                        const projeto = projetos.find((p) => p.id === ev.projetoId);
                        const cliente = clientes.find((c) => c.id === projeto?.clienteId);
                        return (
                          <button
                            key={ev.id}
                            onClick={() =>
                              podeEditar &&
                              setModalInfo({ data: diaISO, periodo: periodo.key, evento: ev })
                            }
                            className="block w-full truncate rounded bg-sky-100 px-2 py-1 text-left text-xs text-sky-800 hover:bg-sky-200"
                            title={ev.descricao}
                          >
                            <span className="font-semibold">{recurso?.nomeCompleto}</span>
                            <br />
                            {nomeExibicaoCliente(cliente)}
                          </button>
                        );
                      })}
                    </div>
                    {podeEditar && (
                      <button
                        onClick={() => setModalInfo({ data: diaISO, periodo: periodo.key, evento: null })}
                        className="mt-1 w-full rounded border border-dashed border-slate-300 py-1 text-xs text-slate-400 hover:border-sky-400 hover:text-sky-600"
                      >
                        + adicionar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {modalInfo && (
        <EventoModal
          aberto
          onClose={() => setModalInfo(null)}
          data={modalInfo.data}
          periodo={modalInfo.periodo}
          eventoEditando={modalInfo.evento}
          projetos={projetos}
          clientes={clientes}
          consultores={consultores}
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
