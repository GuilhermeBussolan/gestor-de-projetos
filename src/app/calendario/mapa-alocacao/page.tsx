"use client";

import { useMemo, useState } from "react";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { CalendarioTabs } from "@/components/layout/CalendarioTabs";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { CelulaMapaAlocacao } from "@/components/calendario/CelulaMapaAlocacao";
import { nomeExibicaoCliente } from "@/lib/cliente";
import {
  diasDoIntervalo,
  diasDoMes,
  idsAtividadesSobrepostas,
  inicioDaSemana,
  montarMapaAlocacao,
  somarDiasIso,
  todasAlocacoes,
} from "@/lib/cronograma";
import type { Cliente, Projeto, Recurso } from "@/types";

const DIAS_SEMANA_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function labelDia(iso: string) {
  const data = new Date(`${iso}T12:00:00`);
  return `${DIAS_SEMANA_ABREV[data.getDay()]} ${iso.slice(8, 10)}`;
}

function MapaAlocacaoPageContent() {
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: recursos } = useCollection<Recurso>("recursos");
  const { data: clientes } = useCollection<Cliente>("clientes");

  const [modo, setModo] = useState<"semana" | "mes">("semana");
  const [ancora, setAncora] = useState(() => new Date().toISOString().slice(0, 10));
  const [recursoId, setRecursoId] = useState("");
  const [projetoId, setProjetoId] = useState("");

  const dias = useMemo(() => {
    if (modo === "semana") {
      const inicio = inicioDaSemana(ancora);
      return diasDoIntervalo(inicio, somarDiasIso(inicio, 6));
    }
    const [ano, mes] = ancora.slice(0, 7).split("-").map(Number);
    return diasDoMes(ano, mes);
  }, [modo, ancora]);

  const todasAloc = useMemo(() => todasAlocacoes(projetos), [projetos]);
  const sobrepostas = useMemo(() => idsAtividadesSobrepostas(todasAloc), [todasAloc]);
  const alocacoesExibidas = useMemo(
    () => (projetoId ? todasAloc.filter((a) => a.projetoId === projetoId) : todasAloc),
    [todasAloc, projetoId]
  );

  const recursosLinhas = useMemo(
    () => (recursoId ? recursos.filter((r) => r.id === recursoId) : recursos),
    [recursos, recursoId]
  );

  const mapa = useMemo(
    () => montarMapaAlocacao(alocacoesExibidas, sobrepostas, recursosLinhas.map((r) => r.id), dias),
    [alocacoesExibidas, sobrepostas, recursosLinhas, dias]
  );

  const projetosComCronograma = useMemo(
    () => projetos.filter((p) => todasAloc.some((a) => a.projetoId === p.id)),
    [projetos, todasAloc]
  );

  return (
    <div>
      <CalendarioTabs />
      <h1 className="mb-1 text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Mapa de Alocação</h1>
      <p className="mb-5 text-sm text-brand-muted">
        Ocupação prevista de cada recurso, vinda dos cronogramas importados. Clique numa célula
        alocada para ver os detalhes.
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
        <div className="w-40 shrink-0">
          <FormRow label={modo === "semana" ? "Um dia da semana" : "Mês"}>
            <Input
              type={modo === "semana" ? "date" : "month"}
              value={modo === "semana" ? ancora : ancora.slice(0, 7)}
              onChange={(e) => setAncora(modo === "semana" ? e.target.value : `${e.target.value}-01`)}
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
      </div>

      <div className="mb-4 flex items-center gap-4 text-[12.5px] text-brand-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-brand-border-soft bg-white" /> Livre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-[#c3d4f7] bg-[#e8efff]" /> Alocado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-[#f3b8b0] bg-[#fdeceb]" /> Sobreposição
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white shadow-card">
        <table className="w-full min-w-[720px] border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[170px] border-b border-brand-border bg-brand-hover px-3 py-2.5 text-left text-[11px] font-bold tracking-[.06em] text-brand-faint uppercase">
                Recurso
              </th>
              {dias.map((d) => (
                <th
                  key={d}
                  className="min-w-[110px] border-b border-l border-brand-border-soft bg-brand-hover px-2 py-2.5 text-center text-[11px] font-bold text-brand-faint"
                >
                  {labelDia(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recursosLinhas.map((r) => (
              <tr key={r.id}>
                <td className="sticky left-0 z-10 border-b border-brand-border-soft bg-white px-3 py-1.5 font-semibold text-brand-navy-2">
                  {r.nomeCompleto}
                </td>
                {dias.map((d) => {
                  const celula = mapa.get(r.id)?.get(d);
                  return (
                    <td key={d} className="border-b border-l border-brand-border-soft p-1 align-top">
                      <CelulaMapaAlocacao
                        status={celula?.status ?? "livre"}
                        alocacoes={celula?.alocacoes ?? []}
                        projetos={projetos}
                        clientes={clientes}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            {recursosLinhas.length === 0 && (
              <tr>
                <td colSpan={dias.length + 1} className="px-4 py-8 text-center text-brand-faint">
                  Nenhum recurso cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
