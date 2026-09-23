"use client";

import {
  TIPOS_ITEM_ORDEM,
  TIPO_ITEM_CONFIG,
  type TipoItemFaturamento,
  type TotalMes,
} from "@/lib/faturamentoPrevisto";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const moedaCompacta = (v: number) =>
  v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k` : moeda(v);

const somaDoMes = (t: TotalMes) => TIPOS_ITEM_ORDEM.reduce((s, tipo) => s + t[tipo], 0);

const LARGURA = 760;
const ALTURA = 260;
const MARGEM_ESQ = 46;
const MARGEM_BAIXO = 26;
const MARGEM_TOPO = 14;

/** Gráfico de barras empilhadas (uma cor por situação: previsto, liberado, faturado, recebido, cancelado) dos 12 meses — sem libs externas. */
export function GraficoFaturamentoBarras({
  totais,
  mesSelecionado,
  onClickMes,
}: {
  totais: TotalMes[];
  mesSelecionado: string | null;
  onClickMes: (mes: string) => void;
}) {
  const maiorTotal = Math.max(1, ...totais.map(somaDoMes));
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
        const baseY = MARGEM_TOPO + alturaUtil;
        const total = somaDoMes(t);
        const selecionado = mesSelecionado === t.mes;
        let acumulado = 0;
        const segmentos = TIPOS_ITEM_ORDEM.map((tipo) => {
          const altura = escalaY(t[tipo]);
          const y = baseY - acumulado - altura;
          acumulado += altura;
          return { tipo, altura, y };
        }).filter((seg) => seg.altura > 0);

        return (
          <g
            key={t.mes}
            onClick={() => total > 0 && onClickMes(t.mes)}
            className={total > 0 ? "cursor-pointer" : ""}
            opacity={mesSelecionado && !selecionado ? 0.55 : 1}
          >
            <title>
              {t.label}: {TIPOS_ITEM_ORDEM.filter((tipo) => t[tipo] > 0).map((tipo) => TIPO_ITEM_CONFIG[tipo].label.toLowerCase() + " " + moeda(t[tipo])).join(" · ") || "sem lançamentos"}
            </title>
            <rect
              x={x - 3}
              y={MARGEM_TOPO}
              width={larguraBarra + 6}
              height={alturaUtil}
              fill="transparent"
            />
            {segmentos.map((seg) => (
              <rect
                key={seg.tipo}
                x={x}
                y={seg.y}
                width={larguraBarra}
                height={seg.altura}
                fill={TIPO_ITEM_CONFIG[seg.tipo].cor}
                rx={2}
              />
            ))}
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

/** Legenda com o total do ano de cada situação, na mesma cor das barras. */
export function LegendaFaturamento({ totais }: { totais?: Record<TipoItemFaturamento, number> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-brand-muted">
      {TIPOS_ITEM_ORDEM.map((tipo) => (
        <span key={tipo} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TIPO_ITEM_CONFIG[tipo].cor }} />
          {TIPO_ITEM_CONFIG[tipo].label}
          {totais && <strong className="text-brand-navy-2">{moeda(totais[tipo])}</strong>}
        </span>
      ))}
    </div>
  );
}
