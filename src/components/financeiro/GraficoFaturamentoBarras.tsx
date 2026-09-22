"use client";

import type { TotalMes } from "@/lib/faturamentoPrevisto";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const moedaCompacta = (v: number) =>
  v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k` : moeda(v);

const COR_LIBERADO = "#15754c";
const COR_PREVISTO = "#2f6fe4";

const LARGURA = 760;
const ALTURA = 260;
const MARGEM_ESQ = 46;
const MARGEM_BAIXO = 26;
const MARGEM_TOPO = 14;

/** Gráfico de barras empilhadas (liberado + previsto) dos 12 meses do ano — sem libs externas. */
export function GraficoFaturamentoBarras({
  totais,
  mesSelecionado,
  onClickMes,
}: {
  totais: TotalMes[];
  mesSelecionado: string | null;
  onClickMes: (mes: string) => void;
}) {
  const maiorTotal = Math.max(1, ...totais.map((t) => t.liberado + t.previsto));
  const alturaUtil = ALTURA - MARGEM_BAIXO - MARGEM_TOPO;
  const larguraUtil = LARGURA - MARGEM_ESQ;
  const larguraBarra = (larguraUtil / totais.length) * 0.55;
  const escalaY = (v: number) => (v / maiorTotal) * alturaUtil;

  const linhasGuia = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="w-full" role="img" aria-label="Faturamento previsto por mês">
      {linhasGuia.map((f) => {
        const y = MARGEM_TOPO + alturaUtil * (1 - f);
        return (
          <g key={f}>
            <line x1={MARGEM_ESQ} y1={y} x2={LARGURA} y2={y} stroke="#e7ebf3" strokeWidth={1} />
            <text x={MARGEM_ESQ - 6} y={y + 3} textAnchor="end" fontSize={9} fill="#8b94ad">
              {moedaCompacta(maiorTotal * f)}
            </text>
          </g>
        );
      })}

      {totais.map((t, i) => {
        const x = MARGEM_ESQ + (larguraUtil / totais.length) * i + (larguraUtil / totais.length - larguraBarra) / 2;
        const alturaLiberado = escalaY(t.liberado);
        const alturaPrevisto = escalaY(t.previsto);
        const baseY = MARGEM_TOPO + alturaUtil;
        const total = t.liberado + t.previsto;
        const selecionado = mesSelecionado === t.mes;

        return (
          <g
            key={t.mes}
            onClick={() => total > 0 && onClickMes(t.mes)}
            className={total > 0 ? "cursor-pointer" : ""}
            opacity={mesSelecionado && !selecionado ? 0.55 : 1}
          >
            <title>
              {t.label}: liberado {moeda(t.liberado)} · previsto {moeda(t.previsto)} · total {moeda(total)}
            </title>
            <rect
              x={x - 3}
              y={MARGEM_TOPO}
              width={larguraBarra + 6}
              height={alturaUtil}
              fill="transparent"
            />
            {alturaPrevisto > 0 && (
              <rect
                x={x}
                y={baseY - alturaLiberado - alturaPrevisto}
                width={larguraBarra}
                height={alturaPrevisto}
                fill={COR_PREVISTO}
                rx={2}
              />
            )}
            {alturaLiberado > 0 && (
              <rect x={x} y={baseY - alturaLiberado} width={larguraBarra} height={alturaLiberado} fill={COR_LIBERADO} rx={2} />
            )}
            {selecionado && (
              <rect
                x={x - 3}
                y={MARGEM_TOPO}
                width={larguraBarra + 6}
                height={alturaUtil}
                fill="none"
                stroke="#151f38"
                strokeDasharray="3 2"
                rx={4}
              />
            )}
            <text
              x={x + larguraBarra / 2}
              y={ALTURA - 8}
              textAnchor="middle"
              fontSize={10}
              fontWeight={selecionado ? 700 : 400}
              fill={selecionado ? "#151f38" : "#6a7594"}
            >
              {t.label}
            </text>
          </g>
        );
      })}

      <line x1={MARGEM_ESQ} y1={MARGEM_TOPO + alturaUtil} x2={LARGURA} y2={MARGEM_TOPO + alturaUtil} stroke="#c7cede" />
    </svg>
  );
}

export function LegendaFaturamento() {
  return (
    <div className="flex items-center gap-4 text-[11.5px] text-brand-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COR_LIBERADO }} /> Liberado
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COR_PREVISTO }} /> Previsto
      </span>
    </div>
  );
}
