"use client";

import { useMemo, useState } from "react";
import { CalendarSearch, ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { CalendarioTabs } from "@/components/layout/CalendarioTabs";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { CelulaMapaAlocacao, COR_TURNO, DetalhesTurno, ROTULO_STATUS } from "@/components/calendario/CelulaMapaAlocacao";
import { PainelDisponibilidade } from "@/components/calendario/PainelDisponibilidade";
import { nomeExibicaoCliente } from "@/lib/cliente";
import {
  ehFimDeSemana,
  diasDoIntervalo,
  diasDoMes,
  horasRealizadasPorTurno,
  inicioDaSemana,
  montarMapaAlocacao,
  ocupacaoDoRecurso,
  PERIODO_LABEL,
  somarDiasIso,
  todasAlocacoes,
  type CelulaTurno,
  type StatusTurno,
} from "@/lib/cronograma";
import type { Cliente, EventoCalendario, PeriodoDia, Projeto, Recurso } from "@/types";

const DIAS_SEMANA_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function labelDia(iso: string) {
  const data = new Date(`${iso}T12:00:00`);
  return `${DIAS_SEMANA_ABREV[data.getDay()]} ${iso.slice(8, 10)}`;
}

function MapaAlocacaoPageContent() {
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: recursos } = useCollection<Recurso>("recursos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const { data: eventos } = useCollection<EventoCalendario>("eventosCalendario", []);

  const hojeIso = new Date().toISOString().slice(0, 10);
  const [modo, setModo] = useState<"semana" | "mes">("semana");
  const [ancora, setAncora] = useState(hojeIso);
  const [recursoId, setRecursoId] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [mostrarLivres, setMostrarLivres] = useState(false);
  const [detalhe, setDetalhe] = useState<{ recursoId: string; data: string; periodo: PeriodoDia; celula: CelulaTurno } | null>(null);

  const dias = useMemo(() => {
    if (modo === "semana") {
      const inicio = inicioDaSemana(ancora);
      return diasDoIntervalo(inicio, somarDiasIso(inicio, 6));
    }
    const [ano, mes] = ancora.slice(0, 7).split("-").map(Number);
    return diasDoMes(ano, mes);
  }, [modo, ancora]);

  const projetosAtivos = useMemo(() => projetos.filter((p) => (p.status ?? "ativo") === "ativo"), [projetos]);
  const todasAloc = useMemo(() => todasAlocacoes(projetosAtivos), [projetosAtivos]);
  const alocacoesExibidas = useMemo(
    () => (projetoId ? todasAloc.filter((a) => a.projetoId === projetoId) : todasAloc),
    [todasAloc, projetoId]
  );
  const realizadas = useMemo(() => horasRealizadasPorTurno(eventos), [eventos]);

  const recursosLinhas = useMemo(
    () => (recursoId ? recursos.filter((r) => r.id === recursoId) : recursos),
    [recursos, recursoId]
  );

  const mapa = useMemo(
    () => montarMapaAlocacao(alocacoesExibidas, recursosLinhas.map((r) => r.id), dias, realizadas),
    [alocacoesExibidas, recursosLinhas, dias, realizadas]
  );

  const projetosComCronograma = useMemo(
    () => projetos.filter((p) => todasAloc.some((a) => a.projetoId === p.id)),
    [projetos, todasAloc]
  );

  const compacto = modo === "mes";
  const totalColunasDia = dias.length * 2;

  function mover(delta: number) {
    if (modo === "semana") setAncora((a) => somarDiasIso(a, 7 * delta));
    else setAncora((a) => format(addMonths(new Date(`${a.slice(0, 7)}-01T12:00:00`), delta), "yyyy-MM-dd"));
  }

  const rotuloPeriodo =
    modo === "semana"
      ? `${dias[0].slice(8, 10)}/${dias[0].slice(5, 7)} – ${dias[dias.length - 1].slice(8, 10)}/${dias[dias.length - 1].slice(5, 7)}/${dias[dias.length - 1].slice(0, 4)}`
      : format(new Date(`${ancora.slice(0, 7)}-01T12:00:00`), "MMMM yyyy", { locale: ptBR });

  function verNoMapa(rid: string, data: string) {
    setRecursoId(rid);
    setModo("semana");
    setAncora(data);
  }

  return (
    <div>
      <CalendarioTabs />
      <h1 className="mb-1 text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Mapa de Alocação</h1>
      <p className="mb-5 text-sm text-brand-muted">
        Agenda prevista de cada consultor, turno a turno (manhã e tarde de 4h), vinda dos cronogramas dos projetos e
        comparada com o que já foi realizado. Clique num turno para ver as tarefas.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <div className="w-32 shrink-0">
          <FormRow label="Visualização">
            <Select value={modo} onChange={(e) => setModo(e.target.value as "semana" | "mes")}>
              <option value="semana">Semana</option>
              <option value="mes">Mês</option>
            </Select>
          </FormRow>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-10 items-center overflow-hidden rounded-[10px] border border-brand-border bg-white">
            <button
              type="button"
              onClick={() => mover(-1)}
              className="flex h-full items-center px-3 text-brand-muted hover:bg-brand-hover"
              aria-label={modo === "semana" ? "Semana anterior" : "Mês anterior"}
              title={modo === "semana" ? "Semana anterior" : "Mês anterior"}
            >
              <ChevronLeft size={17} />
            </button>
            <div className="min-w-[150px] border-x border-brand-border px-3.5 text-center text-[13.5px] font-bold text-brand-navy-2 capitalize">
              {rotuloPeriodo}
            </div>
            <button
              type="button"
              onClick={() => mover(1)}
              className="flex h-full items-center px-3 text-brand-muted hover:bg-brand-hover"
              aria-label={modo === "semana" ? "Próxima semana" : "Próximo mês"}
              title={modo === "semana" ? "Próxima semana" : "Próximo mês"}
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <Button type="button" variant="secondary" onClick={() => setAncora(hojeIso)} className="h-10">
            Hoje
          </Button>
        </div>
        <div className="w-40 shrink-0">
          <FormRow label={modo === "semana" ? "Ir para o dia" : "Ir para o mês"}>
            <Input
              type={modo === "semana" ? "date" : "month"}
              value={modo === "semana" ? ancora : ancora.slice(0, 7)}
              onChange={(e) => e.target.value && setAncora(modo === "semana" ? e.target.value : `${e.target.value}-01`)}
            />
          </FormRow>
        </div>
        <div className="w-56 shrink-0">
          <FormRow label="Recurso/Consultor">
            <Select value={recursoId} onChange={(e) => setRecursoId(e.target.value)}>
              <option value="">Todos</option>
              {recursos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nomeCompleto}
                </option>
              ))}
            </Select>
          </FormRow>
        </div>
        <div className="w-56 shrink-0">
          <FormRow label="Projeto">
            <Select value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
              <option value="">Todos</option>
              {projetosComCronograma.map((p) => (
                <option key={p.id} value={p.id}>
                  {nomeExibicaoCliente(clientes.find((c) => c.id === p.clienteId))} — {p.codigoProposta}
                </option>
              ))}
            </Select>
          </FormRow>
        </div>
        <Button
          type="button"
          variant={mostrarLivres ? "primary" : "secondary"}
          onClick={() => setMostrarLivres((v) => !v)}
          className="mb-0.5 h-10"
        >
          <CalendarSearch size={16} />
          Quem está livre?
        </Button>
      </div>

      {mostrarLivres && (
        <PainelDisponibilidade
          recursos={recursos}
          alocacoes={todasAloc}
          realizadas={realizadas}
          hojeIso={hojeIso}
          onVerNoMapa={verNoMapa}
        />
      )}

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-brand-muted">
        {(["livre", "parcial", "cheio", "sobreposicao", "realizado"] as StatusTurno[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded border ${COR_TURNO[s].borda} ${COR_TURNO[s].fundo}`} /> {ROTULO_STATUS[s]}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white shadow-card">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-10 min-w-[190px] border-b border-brand-border bg-brand-hover px-3 py-2.5 text-left text-[11px] font-bold tracking-[.06em] text-brand-faint uppercase"
              >
                Recurso
              </th>
              {dias.map((d) => (
                <th
                  key={d}
                  colSpan={2}
                  className={`border-l border-brand-border-soft px-1 py-2 text-center text-[11px] font-bold ${
                    ehFimDeSemana(d) ? "bg-[#eef0f6] text-brand-faint" : "bg-brand-hover text-brand-navy-2"
                  } ${d === hojeIso ? "text-brand-accent" : ""}`}
                >
                  {compacto ? d.slice(8, 10) : labelDia(d)}
                </th>
              ))}
            </tr>
            <tr>
              {dias.flatMap((d) =>
                (["manha", "tarde"] as PeriodoDia[]).map((p) => (
                  <th
                    key={`${d}-${p}`}
                    className={`border-b border-brand-border px-1 py-1 text-center text-[9.5px] font-semibold tracking-[.04em] text-brand-faint uppercase ${
                      p === "manha" ? "border-l border-brand-border-soft" : ""
                    } ${ehFimDeSemana(d) ? "bg-[#eef0f6]" : "bg-brand-hover"}`}
                  >
                    {compacto ? p[0].toUpperCase() : PERIODO_LABEL[p]}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {recursosLinhas.map((r) => {
              const ocupacao = ocupacaoDoRecurso(mapa.get(r.id), dias);
              return (
                <tr key={r.id}>
                  <td className="sticky left-0 z-10 border-b border-brand-border-soft bg-white px-3 py-1.5">
                    <p className="truncate font-semibold text-brand-navy-2">{r.nomeCompleto}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-brand-accent-soft">
                        <div
                          className={`h-full rounded-full ${ocupacao > 1 ? "bg-[#d9503f]" : "bg-brand-accent"}`}
                          style={{ width: `${Math.min(100, ocupacao * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10.5px] font-bold text-brand-muted">{Math.round(ocupacao * 100)}% ocupado</span>
                    </div>
                  </td>
                  {dias.flatMap((d) =>
                    (["manha", "tarde"] as PeriodoDia[]).map((p) => {
                      const celula = mapa.get(r.id)?.get(d)?.[p];
                      return (
                        <td
                          key={`${d}-${p}`}
                          className={`border-b border-brand-border-soft p-[3px] align-top ${
                            p === "manha" ? "border-l border-brand-border-soft" : ""
                          } ${ehFimDeSemana(d) ? "bg-[#f6f7fb]" : ""}`}
                          style={{ minWidth: compacto ? 34 : 96 }}
                        >
                          {celula && (
                            <CelulaMapaAlocacao
                              celula={celula}
                              compacto={compacto}
                              projetos={projetos}
                              clientes={clientes}
                              onAbrir={() => setDetalhe({ recursoId: r.id, data: d, periodo: p, celula })}
                            />
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
            {recursosLinhas.length === 0 && (
              <tr>
                <td colSpan={totalColunasDia + 1} className="px-4 py-8 text-center text-brand-faint">
                  Nenhum recurso cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!detalhe} onClose={() => setDetalhe(null)} title="Agenda do turno" wide>
        {detalhe && (
          <DetalhesTurno
            celula={detalhe.celula}
            periodo={detalhe.periodo}
            data={detalhe.data}
            recursoNome={recursos.find((r) => r.id === detalhe.recursoId)?.nomeCompleto ?? "Recurso"}
            projetos={projetos}
            clientes={clientes}
          />
        )}
      </Modal>

    </div>
  );
}

export default function MapaAlocacaoPage() {
  return (
    <ProtectedPage perfis={["administrador", "coordenador"]}>
      <MapaAlocacaoPageContent />
    </ProtectedPage>
  );
}
