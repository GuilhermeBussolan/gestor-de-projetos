"use client";

import { useMemo, useState } from "react";
import { CalendarSearch } from "lucide-react";
import { FormRow, Input, Select } from "@/components/ui/Field";
import {
  HORAS_POR_TURNO,
  PERIODO_LABEL,
  diasDoIntervalo,
  montarMapaAlocacao,
  somarDiasIso,
  turnosLivresDoRecurso,
  type AlocacaoAtividade,
} from "@/lib/cronograma";
import { formatarMinutos } from "@/lib/escopo";
import type { PeriodoDia, Recurso } from "@/types";

const LIMITE_DIAS = 92;

function dataCurta(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "Quem está livre?": lista os recursos com turnos livres num intervalo — para decidir onde alocar. */
export function PainelDisponibilidade({
  recursos,
  alocacoes,
  realizadas,
  hojeIso,
  onVerNoMapa,
}: {
  recursos: Recurso[];
  alocacoes: AlocacaoAtividade[];
  realizadas: Map<string, number>;
  hojeIso: string;
  onVerNoMapa: (recursoId: string, data: string) => void;
}) {
  const [de, setDe] = useState(hojeIso);
  const [ate, setAte] = useState(() => somarDiasIso(hojeIso, 13));
  const [turno, setTurno] = useState<"ambos" | PeriodoDia>("ambos");
  const [comFimDeSemana, setComFimDeSemana] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const intervaloValido = !!de && !!ate && de <= ate;
  const dias = useMemo(() => {
    if (!intervaloValido) return [];
    const todos = diasDoIntervalo(de, ate);
    return todos.slice(0, LIMITE_DIAS);
  }, [de, ate, intervaloValido]);
  const truncado = intervaloValido && diasDoIntervalo(de, ate).length > LIMITE_DIAS;

  const turnos: PeriodoDia[] = turno === "ambos" ? ["manha", "tarde"] : [turno];

  const resultado = useMemo(() => {
    const mapa = montarMapaAlocacao(alocacoes, recursos.map((r) => r.id), dias, realizadas);
    return recursos
      .map((r) => {
        const livres = turnosLivresDoRecurso(mapa.get(r.id), dias, turnos, comFimDeSemana);
        const totalTurnos =
          dias.filter((d) => comFimDeSemana || ![0, 6].includes(new Date(`${d}T12:00:00`).getDay())).length * turnos.length;
        const horasLivres = livres.reduce((s, t) => s + t.horasLivres, 0);
        return { recurso: r, livres, totalTurnos, horasLivres };
      })
      .sort((a, b) => b.horasLivres - a.horasLivres);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alocacoes, recursos, dias, realizadas, turno, comFimDeSemana]);

  return (
    <div className="mb-4 rounded-2xl border border-brand-accent/30 bg-brand-accent-soft/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-[14px] font-extrabold text-brand-navy-2">
        <CalendarSearch size={17} className="text-brand-accent" />
        Quem está livre?
        <span className="text-[12px] font-medium text-brand-muted">
          — considera o previsto dos cronogramas e o que já foi realizado
        </span>
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-2.5">
        <div className="w-40">
          <FormRow label="De">
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </FormRow>
        </div>
        <div className="w-40">
          <FormRow label="Até">
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </FormRow>
        </div>
        <div className="w-36">
          <FormRow label="Turno">
            <Select value={turno} onChange={(e) => setTurno(e.target.value as "ambos" | PeriodoDia)}>
              <option value="ambos">Manhã e tarde</option>
              <option value="manha">Só manhã</option>
              <option value="tarde">Só tarde</option>
            </Select>
          </FormRow>
        </div>
        <label className="mb-2 flex items-center gap-2 text-[13px] text-brand-navy-2">
          <input type="checkbox" checked={comFimDeSemana} onChange={(e) => setComFimDeSemana(e.target.checked)} />
          Incluir fins de semana
        </label>
      </div>
      {!intervaloValido && <p className="text-[12.5px] text-[#b5392a]">Escolha um intervalo válido (a data final não pode ser anterior à inicial).</p>}
      {truncado && <p className="mb-2 text-[12px] text-brand-faint">Mostrando os primeiros {LIMITE_DIAS} dias do intervalo.</p>}

      {intervaloValido && (
        <div className="divide-y divide-brand-border-soft overflow-hidden rounded-xl border border-brand-border bg-white">
          {resultado.map(({ recurso, livres, totalTurnos, horasLivres }) => {
            const expandido = aberto === recurso.id;
            return (
              <div key={recurso.id}>
                <button
                  type="button"
                  onClick={() => setAberto(expandido ? null : recurso.id)}
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-brand-hover"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-brand-navy-2">{recurso.nomeCompleto}</span>
                  <span className="text-[12px] text-brand-muted">
                    <strong className={livres.length > 0 ? "text-[#15754c]" : "text-[#b5392a]"}>{livres.length}</strong> de {totalTurnos} turnos livres
                  </span>
                  <span className="w-24 text-right text-[12px] font-bold text-brand-navy-2">{formatarMinutos(Math.round(horasLivres * 60))}</span>
                  <span className="text-[11px] text-brand-faint">{expandido ? "▲" : "▼"}</span>
                </button>
                {expandido && (
                  <div className="flex flex-wrap gap-1.5 bg-brand-hover px-3.5 py-2.5">
                    {livres.length === 0 && <span className="text-[12px] text-brand-faint">Sem turnos livres neste intervalo.</span>}
                    {livres.slice(0, 60).map((t) => (
                      <button
                        key={`${t.data}-${t.periodo}`}
                        type="button"
                        onClick={() => onVerNoMapa(recurso.id, t.data)}
                        title={`${formatarMinutos(Math.round(t.horasLivres * 60))} livres — ver no mapa`}
                        className="rounded-full border border-[#b9e2cb] bg-[#e3f5ea] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#15754c] hover:brightness-95"
                      >
                        {dataCurta(t.data)} · {PERIODO_LABEL[t.periodo]}
                        {t.horasLivres < HORAS_POR_TURNO ? ` (${formatarMinutos(Math.round(t.horasLivres * 60))})` : ""}
                      </button>
                    ))}
                    {livres.length > 60 && <span className="text-[12px] text-brand-faint">+{livres.length - 60} turnos</span>}
                  </div>
                )}
              </div>
            );
          })}
          {resultado.length === 0 && <p className="p-4 text-center text-[13px] text-brand-faint">Nenhum recurso cadastrado.</p>}
        </div>
      )}
    </div>
  );
}
