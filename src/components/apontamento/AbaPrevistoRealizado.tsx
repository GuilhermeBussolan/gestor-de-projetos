"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { nomeExibicaoCliente } from "@/lib/cliente";
import {
  dataBR,
  detalheTarefasDoGrupo,
  exportarRelatorioCsv,
  exportarRelatorioPdf,
  filtrarLinhasGrupo,
  montarRelatorioGrupos,
  type FiltrosRelatorioHoras,
} from "@/lib/relatorioPrevistoRealizado";
import type { CenarioComparativo } from "@/lib/comparativoHoras";
import type { Cliente, EventoCalendario, Projeto, Recurso } from "@/types";

const STATUS_CONFIG: Record<CenarioComparativo, { label: string; bg: string; text: string }> = {
  abaixo: { label: "Abaixo", bg: "#fff2de", text: "#a4650d" },
  dentro: { label: "Dentro", bg: "#e3f5ea", text: "#15754c" },
  acima: { label: "Acima", bg: "#fdeceb", text: "#b5392a" },
};

export function AbaPrevistoRealizado({
  eventos,
  projetos,
  clientes,
  recursos,
}: {
  eventos: EventoCalendario[];
  projetos: Projeto[];
  clientes: Cliente[];
  recursos: Recurso[];
}) {
  const [filtros, setFiltros] = useState<FiltrosRelatorioHoras>({
    mes: "",
    recursoId: "",
    status: "",
    projetoId: "",
    grupoId: "",
  });
  const [expandido, setExpandido] = useState<string | null>(null);

  const eventosDoPeriodo = useMemo(
    () => (filtros.mes ? eventos.filter((e) => e.data.startsWith(filtros.mes)) : eventos),
    [eventos, filtros.mes]
  );

  const todasLinhas = useMemo(
    () => montarRelatorioGrupos(projetos, clientes, eventosDoPeriodo),
    [projetos, clientes, eventosDoPeriodo]
  );
  const linhas = useMemo(
    () => filtrarLinhasGrupo(todasLinhas, projetos, filtros),
    [todasLinhas, projetos, filtros]
  );

  const projetosComGrupo = useMemo(() => {
    const ids = new Set(todasLinhas.map((l) => l.projetoId));
    return projetos.filter((p) => ids.has(p.id));
  }, [todasLinhas, projetos]);

  function limparFiltros() {
    setFiltros({ mes: "", recursoId: "", status: "", projetoId: "", grupoId: "" });
  }

  const temFiltro = filtros.mes || filtros.recursoId || filtros.status || filtros.projetoId || filtros.grupoId;

  return (
    <div>
      <p className="mb-4 text-sm text-brand-muted">
        Grupos de rotina com duração cadastrada (cronograma importado), comparando o previsto com o
        que já foi apontado e aprovado. Clique numa linha para ver o detalhe por tarefa.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <div className="w-40 shrink-0">
          <FormRow label="Período (mês)">
            <Input type="month" value={filtros.mes} onChange={(e) => setFiltros((f) => ({ ...f, mes: e.target.value }))} />
          </FormRow>
        </div>
        <div className="w-52 shrink-0">
          <FormRow label="Consultor/Recurso">
            <Select
              value={filtros.recursoId}
              onChange={(e) => setFiltros((f) => ({ ...f, recursoId: e.target.value }))}
            >
              <option value="">Todos</option>
              {recursos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nomeCompleto}
                </option>
              ))}
            </Select>
          </FormRow>
        </div>
        <div className="w-40 shrink-0">
          <FormRow label="Status">
            <Select
              value={filtros.status}
              onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value as FiltrosRelatorioHoras["status"] }))}
            >
              <option value="">Todos</option>
              <option value="abaixo">Abaixo</option>
              <option value="dentro">Dentro</option>
              <option value="acima">Acima</option>
            </Select>
          </FormRow>
        </div>
        <div className="w-56 shrink-0">
          <FormRow label="Projeto">
            <Select
              value={filtros.projetoId}
              onChange={(e) => setFiltros((f) => ({ ...f, projetoId: e.target.value, grupoId: "" }))}
            >
              <option value="">Todos</option>
              {projetosComGrupo.map((p) => (
                <option key={p.id} value={p.id}>
                  {nomeExibicaoCliente(clientes.find((c) => c.id === p.clienteId))} — {p.codigoProposta}
                </option>
              ))}
            </Select>
          </FormRow>
        </div>
        {temFiltro && (
          <button type="button" onClick={limparFiltros} className="mb-2.5 text-[12.5px] font-semibold text-brand-accent hover:underline">
            Limpar filtros
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" disabled={linhas.length === 0} onClick={() => exportarRelatorioCsv(linhas)}>
            Exportar CSV
          </Button>
          <Button variant="secondary" disabled={linhas.length === 0} onClick={() => exportarRelatorioPdf(linhas)}>
            Exportar PDF
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="bg-brand-hover text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
                <th className="px-4 py-3">Cliente / Projeto</th>
                <th className="px-4 py-3">Grupo de rotina</th>
                <th className="px-4 py-3 text-right">Previsto</th>
                <th className="px-4 py-3 text-right">Realizado</th>
                <th className="px-4 py-3 text-right">Diferença</th>
                <th className="px-4 py-3 text-right">%</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const chave = `${l.projetoId}:${l.grupoId}`;
                const aberto = expandido === chave;
                const cfg = STATUS_CONFIG[l.status];
                const projeto = projetos.find((p) => p.id === l.projetoId);
                return (
                  <Fragment key={chave}>
                    <tr
                      onClick={() => setExpandido(aberto ? null : chave)}
                      className="cursor-pointer border-t border-brand-border-soft hover:bg-brand-hover"
                    >
                      <td className="px-4 py-3 text-brand-muted">
                        {l.clienteNome} — {l.projetoNome}
                      </td>
                      <td className="px-4 py-3 font-bold text-brand-navy-2">
                        <span className="flex items-center gap-1.5">
                          {aberto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          {l.grupoDescricao}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-brand-navy-2">{l.horasPrevistas.toFixed(1)}h</td>
                      <td className="px-4 py-3 text-right text-brand-navy-2">{l.horasRealizadas.toFixed(1)}h</td>
                      <td className="px-4 py-3 text-right font-semibold text-brand-navy-2">
                        {l.diferenca > 0 ? "+" : ""}
                        {l.diferenca.toFixed(1)}h
                      </td>
                      <td className="px-4 py-3 text-right text-brand-muted">{l.percentualRealizado.toFixed(0)}%</td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold"
                          style={{ backgroundColor: cfg.bg, color: cfg.text }}
                        >
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                    {aberto && projeto && (
                      <tr className="border-t border-brand-border-soft bg-brand-hover/40">
                        <td colSpan={7} className="px-4 py-3.5">
                          <table className="w-full text-[12px]">
                            <thead>
                              <tr className="text-left text-[10.5px] font-bold tracking-[.06em] text-brand-faint uppercase">
                                <th className="py-1.5">Tarefa</th>
                                <th className="py-1.5">Recurso</th>
                                <th className="py-1.5">Data</th>
                                <th className="py-1.5 text-right">Previsto</th>
                                <th className="py-1.5 text-right">Realizado</th>
                                <th className="py-1.5 text-right">Diferença</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detalheTarefasDoGrupo(projeto, l.grupoIndice, recursos, eventosDoPeriodo).map((t) => (
                                <tr key={t.atividadeId} className="border-t border-brand-border-soft">
                                  <td className="py-1.5 text-brand-navy-2">{t.descricao}</td>
                                  <td className="py-1.5 text-brand-muted">{t.recursoNome}</td>
                                  <td className="py-1.5 text-brand-muted">{dataBR(t.data)}</td>
                                  <td className="py-1.5 text-right text-brand-navy-2">{t.horasPrevistas.toFixed(1)}h</td>
                                  <td className="py-1.5 text-right text-brand-navy-2">{t.horasRealizadas.toFixed(1)}h</td>
                                  <td className="py-1.5 text-right text-brand-muted">
                                    {t.diferenca > 0 ? "+" : ""}
                                    {t.diferenca.toFixed(1)}h
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-brand-faint">
                    {todasLinhas.length === 0
                      ? "Nenhum projeto com cronograma (duração) importado ainda."
                      : "Nenhum grupo encontrado para esse filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
