"use client";

import { useMemo, useState } from "react";
import { KpiCard, PainelVazio } from "@/components/ui/KpiCard";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { formatarHoras } from "@/lib/horas";
import type { Cliente, EventoCalendario, Projeto } from "@/types";

function formatarDataBR(iso: string) {
  return iso.split("-").reverse().join("/");
}

/** Total de horas, dias com lançamento e projetos atendidos de uma lista de apontamentos. */
export function KpisHoras({
  eventos,
  projetos,
  clientes,
  tipo,
}: {
  eventos: EventoCalendario[];
  projetos: Projeto[];
  clientes: Cliente[];
  tipo: "aprovadas" | "previstas";
}) {
  const [kpiAberto, setKpiAberto] = useState<"horas" | "dias" | "projetos" | null>(null);

  const totalHoras = eventos.reduce((acc, e) => acc + e.totalHoras, 0);
  const diasLancados = new Set(eventos.map((e) => e.data)).size;
  const projetosAtendidos = useMemo(() => {
    const ids = new Set(eventos.map((e) => e.projetoId));
    return projetos.filter((p) => ids.has(p.id));
  }, [eventos, projetos]);

  const horasPorCliente = useMemo(() => {
    const mapa = new Map<string, number>();
    eventos.forEach((e) => {
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
  }, [eventos, projetos, clientes]);

  const horasPorDia = useMemo(() => {
    const mapa = new Map<string, number>();
    eventos.forEach((e) => mapa.set(e.data, (mapa.get(e.data) ?? 0) + e.totalHoras));
    return [...mapa.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [eventos]);

  const previstas = tipo === "previstas";
  const adjetivo = previstas ? "previstas" : "aprovadas";
  const titulo = "mb-2 px-1 text-[11px] font-bold tracking-[.08em] text-brand-faint uppercase";
  const linha = "flex items-center justify-between gap-2 px-2 py-1.5 text-[12.5px] text-brand-navy-2";

  return (
    <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        label={previstas ? "Total de horas previstas" : "Total de horas"}
        valor={formatarHoras(totalHoras)}
        nota={`todas as horas ${adjetivo}`}
        aberto={kpiAberto === "horas"}
        onToggle={() => setKpiAberto((v) => (v === "horas" ? null : "horas"))}
      >
        <p className={titulo}>Horas {adjetivo} por cliente</p>
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {horasPorCliente.map((h) => (
            <div key={h.clienteId} className={linha}>
              <span className="truncate">{h.nome}</span>
              <span className="shrink-0 font-bold">{formatarHoras(h.horas)}</span>
            </div>
          ))}
          {horasPorCliente.length === 0 && <PainelVazio />}
        </div>
      </KpiCard>

      <KpiCard
        label={previstas ? "Dias com lançamento (previstos)" : "Dias com lançamento"}
        valor={String(diasLancados)}
        nota={`dias distintos com horas ${adjetivo}`}
        aberto={kpiAberto === "dias"}
        onToggle={() => setKpiAberto((v) => (v === "dias" ? null : "dias"))}
      >
        <p className={titulo}>Horas {adjetivo} por dia</p>
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {horasPorDia.map(([data, horas]) => (
            <div key={data} className={linha}>
              <span className="truncate">{formatarDataBR(data)}</span>
              <span className="shrink-0 font-bold">{formatarHoras(horas)}</span>
            </div>
          ))}
          {horasPorDia.length === 0 && <PainelVazio />}
        </div>
      </KpiCard>

      <KpiCard
        label={previstas ? "Projetos atendidos (previstos)" : "Projetos atendidos"}
        valor={String(projetosAtendidos.length)}
        nota={`projetos com horas ${adjetivo}`}
        aberto={kpiAberto === "projetos"}
        onToggle={() => setKpiAberto((v) => (v === "projetos" ? null : "projetos"))}
      >
        <p className={titulo}>Projetos atendidos</p>
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {projetosAtendidos.map((p) => (
            <div key={p.id} className={linha}>
              <span className="truncate">{nomeExibicaoCliente(clientes.find((c) => c.id === p.clienteId))}</span>
              <span className="shrink-0 text-[11px] text-brand-faint">{p.codigoProposta}</span>
            </div>
          ))}
          {projetosAtendidos.length === 0 && <PainelVazio />}
        </div>
      </KpiCard>
    </div>
  );
}
