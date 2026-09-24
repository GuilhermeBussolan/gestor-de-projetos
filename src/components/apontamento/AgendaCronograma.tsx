"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { EventoModal } from "@/components/calendario/EventoModal";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { HORARIO_PERIODO, PERIODO_LABEL, somarDiasIso } from "@/lib/cronograma";
import { formatarMinutos } from "@/lib/escopo";
import { previstosDoCronograma, type PrevistoCronograma, type SituacaoPrevisto } from "@/lib/agendaPrevista";
import type { Cliente, EventoCalendario, Projeto, Recurso, Usuario } from "@/types";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const LIMITE_INICIAL = 100;

const SITUACAO: Record<SituacaoPrevisto, { label: string; bg: string; text: string }> = {
  a_fazer: { label: "A fazer", bg: "#e8efff", text: "#2f6fe4" },
  hoje: { label: "Hoje", bg: "#fff2de", text: "#a4650d" },
  atrasada: { label: "Atrasada", bg: "#fdeceb", text: "#b5392a" },
  apontada: { label: "Apontada", bg: "#e3f5ea", text: "#15754c" },
};

type FiltroSituacao = "pendentes" | SituacaoPrevisto | "todas";

function horasCurtas(horas: number) {
  return formatarMinutos(Math.round(horas * 60));
}

function Indicador({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl border border-brand-border bg-white px-4 py-3.5 shadow-card">
      <p className="text-[10.5px] font-bold tracking-[.08em] text-brand-faint uppercase">{rotulo}</p>
      <p className={`mt-0.5 text-[22px] font-extrabold tracking-[-0.02em] ${destaque ? "text-[#b5392a]" : "text-brand-navy-2"}`}>{valor}</p>
      <p className="text-[11.5px] text-brand-faint">{detalhe}</p>
    </div>
  );
}

/**
 * "Horas previstas" do consultor a partir dos cronogramas: o que cada projeto previu para ele, dia e
 * turno, com a situação (a fazer / hoje / atrasada / apontada) e o atalho para apontar.
 * Administrador e coordenador enxergam todos os consultores e podem filtrar por um.
 */
export function AgendaCronograma({
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
  const hojeIso = format(new Date(), "yyyy-MM-dd");
  const [filtroProjetoId, setFiltroProjetoId] = useState("");
  const [filtroRecursoId, setFiltroRecursoId] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacao>("pendentes");
  const [filtroMes, setFiltroMes] = useState("");
  const [limite, setLimite] = useState(LIMITE_INICIAL);
  const [apontando, setApontando] = useState<PrevistoCronograma | null>(null);

  const todos = useMemo(
    () =>
      previstosDoCronograma({
        projetos,
        eventos,
        hojeIso,
        recursoIds: souConsultor ? new Set(usuario.recursoId ? [usuario.recursoId] : []) : undefined,
      }),
    [projetos, eventos, hojeIso, souConsultor, usuario.recursoId]
  );

  const doEscopo = useMemo(
    () =>
      todos.filter(
        (g) => (!filtroProjetoId || g.projetoId === filtroProjetoId) && (!filtroRecursoId || g.recursoId === filtroRecursoId)
      ),
    [todos, filtroProjetoId, filtroRecursoId]
  );

  const projetosComAgenda = useMemo(() => {
    const ids = new Set(todos.map((g) => g.projetoId));
    return projetos.filter((p) => ids.has(p.id));
  }, [todos, projetos]);

  const mesReferencia = filtroMes || hojeIso.slice(0, 7);
  const nomeMes = useMemo(() => {
    const t = format(new Date(`${mesReferencia}-01T12:00:00`), "MMMM 'de' yyyy", { locale: ptBR });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }, [mesReferencia]);

  const indicadores = useMemo(() => {
    const pendentes = doEscopo.filter((g) => g.situacao !== "apontada");
    const soma = (lista: PrevistoCronograma[]) => lista.reduce((s, g) => s + g.horas, 0);
    const fim7 = somarDiasIso(hojeIso, 6);
    const atrasadas = pendentes.filter((g) => g.situacao === "atrasada");
    const atrasadasDoPeriodo = filtroMes ? atrasadas.filter((g) => g.data.startsWith(filtroMes)) : atrasadas;
    return {
      hoje: soma(pendentes.filter((g) => g.data === hojeIso)),
      proximos7: soma(pendentes.filter((g) => g.data >= hojeIso && g.data <= fim7)),
      // "No mês" e "Atrasadas" seguem o filtro de mês (sem filtro: o mês atual / tudo que está atrasado).
      mes: soma(pendentes.filter((g) => g.data.startsWith(mesReferencia))),
      atrasadasQtd: atrasadasDoPeriodo.length,
      atrasadasHoras: soma(atrasadasDoPeriodo),
    };
  }, [doEscopo, hojeIso, mesReferencia, filtroMes]);

  const lista = useMemo(() => {
    return doEscopo
      .filter((g) => {
        if (filtroSituacao === "pendentes") return g.situacao !== "apontada";
        if (filtroSituacao !== "todas" && g.situacao !== filtroSituacao) return false;
        return true;
      })
      .filter((g) => !filtroMes || g.data.startsWith(filtroMes))
      .sort((a, b) => a.data.localeCompare(b.data) || a.periodo.localeCompare(b.periodo));
  }, [doEscopo, filtroSituacao, filtroMes]);

  if (souConsultor && !usuario.recursoId) {
    return (
      <p className="rounded-2xl border border-dashed border-brand-border bg-white p-6 text-sm text-brand-muted">
        Seu usuário ainda não está vinculado a um recurso. Peça a um administrador para vincular seu usuário a um recurso em Cadastros →
        Usuários.
      </p>
    );
  }

  const filtrando = !!(filtroProjetoId || filtroRecursoId || filtroMes || filtroSituacao !== "pendentes");

  return (
    <div>
      <p className="mb-4 text-sm text-brand-muted">
        {souConsultor
          ? "O que os cronogramas dos projetos preveem para você, dia a dia e turno a turno. Clique em Apontar para lançar as horas de um turno."
          : "O que os cronogramas preveem para cada consultor, dia a dia e turno a turno, com a situação de cada um."}
      </p>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador rotulo="Hoje" valor={horasCurtas(indicadores.hoje)} detalhe="horas previstas para hoje" />
        <Indicador rotulo="Próximos 7 dias" valor={horasCurtas(indicadores.proximos7)} detalhe="horas previstas, contando hoje" />
        <Indicador
          rotulo={filtroMes ? nomeMes : "No mês"}
          valor={horasCurtas(indicadores.mes)}
          detalhe={filtroMes ? "horas previstas neste mês, por apontar" : "ainda por apontar neste mês"}
        />
        <Indicador
          rotulo="Atrasadas"
          valor={String(indicadores.atrasadasQtd)}
          detalhe={
            indicadores.atrasadasQtd > 0
              ? `${horasCurtas(indicadores.atrasadasHoras)} sem apontamento${filtroMes ? " neste mês" : ""}`
              : filtroMes
                ? "nada em atraso neste mês"
                : "nada em atraso"
          }
          destaque={indicadores.atrasadasQtd > 0}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        {!souConsultor && (
          <FormRow label="Consultor">
            <Select value={filtroRecursoId} onChange={(e) => setFiltroRecursoId(e.target.value)} className="w-52">
              <option value="">Todos</option>
              {recursos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nomeCompleto}
                </option>
              ))}
            </Select>
          </FormRow>
        )}
        <FormRow label="Cliente / projeto">
          <Select value={filtroProjetoId} onChange={(e) => setFiltroProjetoId(e.target.value)} className="w-56">
            <option value="">Todos</option>
            {projetosComAgenda.map((p) => (
              <option key={p.id} value={p.id}>
                {nomeExibicaoCliente(clientes.find((c) => c.id === p.clienteId))} — {p.codigoProposta}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Situação">
          <Select value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value as FiltroSituacao)} className="w-44">
            <option value="pendentes">Pendentes</option>
            <option value="atrasada">Atrasadas</option>
            <option value="hoje">Hoje</option>
            <option value="a_fazer">A fazer</option>
            <option value="apontada">Apontadas</option>
            <option value="todas">Todas</option>
          </Select>
        </FormRow>
        <FormRow label="Mês">
          <Input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-40" />
        </FormRow>
        {filtrando && (
          <button
            type="button"
            onClick={() => {
              setFiltroProjetoId("");
              setFiltroRecursoId("");
              setFiltroMes("");
              setFiltroSituacao("pendentes");
            }}
            className="mb-2.5 text-[12.5px] font-semibold text-brand-accent hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-brand-border bg-brand-hover text-left text-[10.5px] font-bold tracking-[.08em] text-brand-faint uppercase">
              <th className="px-4 py-2.5">Data</th>
              <th className="px-3 py-2.5">Turno</th>
              {!souConsultor && <th className="px-3 py-2.5">Consultor</th>}
              <th className="px-3 py-2.5">Cliente / projeto</th>
              <th className="px-3 py-2.5">Tarefas</th>
              <th className="px-3 py-2.5 text-right">Horas</th>
              <th className="px-3 py-2.5">Situação</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {lista.slice(0, limite).map((g) => {
              const projeto = projetos.find((p) => p.id === g.projetoId);
              const cliente = nomeExibicaoCliente(clientes.find((c) => c.id === projeto?.clienteId));
              const recurso = recursos.find((r) => r.id === g.recursoId);
              const dia = new Date(`${g.data}T12:00:00`);
              const cfg = SITUACAO[g.situacao];
              return (
                <tr key={g.chave} className="border-b border-brand-border-soft last:border-b-0 hover:bg-brand-hover">
                  <td className="px-4 py-2.5 font-semibold whitespace-nowrap text-brand-navy-2">
                    {g.data.split("-").reverse().join("/")}
                    <span className="ml-1.5 text-[11.5px] font-medium text-brand-faint">{DIAS_SEMANA[dia.getDay()]}</span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-brand-muted">{PERIODO_LABEL[g.periodo]}</td>
                  {!souConsultor && <td className="px-3 py-2.5 whitespace-nowrap text-brand-navy-2">{recurso?.nomeCompleto ?? "—"}</td>}
                  <td className="px-3 py-2.5 text-brand-navy-2">
                    <span className="font-semibold">{cliente}</span>
                    <span className="text-brand-faint"> — {projeto?.codigoProposta}</span>
                  </td>
                  <td className="max-w-[320px] px-3 py-2.5 text-brand-muted" title={g.nomes.join(" · ")}>
                    <span className="block truncate">{g.nomes.length === 1 ? g.nomes[0] : `${g.nomes[0]} +${g.nomes.length - 1}`}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap text-brand-navy-2">{horasCurtas(g.horas)}</td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {g.situacao !== "apontada" && (
                      <Button type="button" variant="secondary" onClick={() => setApontando(g)} className="h-8 px-3 text-[12.5px]">
                        Apontar
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={souConsultor ? 7 : 8} className="px-4 py-12 text-center">
                  <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand-accent-soft text-brand-accent">
                    <CalendarCheck size={18} />
                  </span>
                  <p className="text-sm font-bold text-brand-navy-2">
                    {todos.length === 0 ? "Nenhuma agenda prevista nos cronogramas" : "Nada encontrado com esses filtros"}
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-[12.5px] text-brand-faint">
                    {todos.length === 0
                      ? "A agenda aparece quando um cronograma de projeto traz consultor e data de início para as tarefas."
                      : "Ajuste a situação, o projeto ou o mês."}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {lista.length > limite && (
        <div className="mt-3 flex items-center justify-center gap-3 text-[12.5px] text-brand-muted">
          Mostrando {limite} de {lista.length}
          <Button type="button" variant="secondary" onClick={() => setLimite((l) => l + LIMITE_INICIAL)} className="h-8 px-3 text-[12.5px]">
            Mostrar mais
          </Button>
        </div>
      )}

      {apontando && (
        <EventoModal
          aberto
          onClose={() => setApontando(null)}
          data={apontando.data}
          horaInicioPadrao={HORARIO_PERIODO[apontando.periodo].horaInicio}
          horaFimPadrao={HORARIO_PERIODO[apontando.periodo].horaFim}
          eventoEditando={null}
          projetos={projetos}
          clientes={clientes}
          recursos={recursos}
          usuario={usuario}
          eventos={eventos}
          preenchimento={{
            projetoId: apontando.projetoId,
            recursoId: apontando.recursoId,
            atividadesMarcadas: apontando.atividadeIds,
            descricao: apontando.nomes.join("; "),
          }}
        />
      )}
    </div>
  );
}
