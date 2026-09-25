"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SEGMENTO_CONFIG, type ResumoSegmento, type SegmentoLiotNg } from "@/lib/segmentacaoLiotNg";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const percentual = (parte: number, todo: number) => (todo > 0 ? `${Math.round((parte / todo) * 100)}%` : "—");

const RAIO = 78;
const CENTRO = 90;

function caminhoFatia(inicio: number, fim: number): string {
  const ponto = (a: number) => [CENTRO + RAIO * Math.sin(a), CENTRO - RAIO * Math.cos(a)];
  const [x1, y1] = ponto(inicio);
  const [x2, y2] = ponto(fim);
  const grande = fim - inicio > Math.PI ? 1 : 0;
  return `M ${CENTRO} ${CENTRO} L ${x1} ${y1} A ${RAIO} ${RAIO} 0 ${grande} 1 ${x2} ${y2} Z`;
}

/** Degraus do drill-down de um segmento: total de venda -> vendido -> recebido. */
function Degraus({ r }: { r: ResumoSegmento }) {
  const cfg = SEGMENTO_CONFIG[r.segmento];
  const base = Math.max(r.totalVenda, 1);
  const linhas = [
    { rotulo: "Valor total de venda", valor: r.totalVenda, nota: "propostas do segmento" },
    { rotulo: "Vendido", valor: r.vendido, nota: `liberado, faturado ou recebido · ${percentual(r.vendido, r.totalVenda)} do total` },
    { rotulo: "Recebido", valor: r.recebido, nota: `${percentual(r.recebido, r.vendido)} do vendido · ${percentual(r.recebido, r.totalVenda)} do total` },
  ];
  return (
    <div className="rounded-xl border border-brand-border bg-white p-4">
      <p className="mb-3 flex items-center gap-2 text-[14px] font-extrabold text-brand-navy-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cfg.cor }} />
        {cfg.label}
        <span className="text-[12px] font-medium text-brand-faint">
          {cfg.descricao} · {r.projetos} projeto{r.projetos === 1 ? "" : "s"}
        </span>
      </p>
      <div className="space-y-3">
        {linhas.map((l) => (
          <div key={l.rotulo}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] font-semibold text-brand-navy-2">{l.rotulo}</span>
              <span className="text-[14px] font-extrabold text-brand-navy-2">{moeda(l.valor)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-brand-bg">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (l.valor / base) * 100)}%`, backgroundColor: cfg.cor }} />
            </div>
            <p className="mt-0.5 text-[11px] text-brand-faint">{l.nota}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Pizza LIOT x NG pelo valor total de venda. Clicar numa fatia (ou em "Expandir") abre os degraus:
 * total de venda -> vendido -> recebido, do segmento escolhido ou dos dois.
 */
export function GraficoPizzaLiotNg({ dados }: { dados: Record<SegmentoLiotNg, ResumoSegmento> }) {
  const [expandido, setExpandido] = useState(false);
  const [foco, setFoco] = useState<SegmentoLiotNg | null>(null);
  const segmentos: SegmentoLiotNg[] = ["LIOT", "NG"];
  const total = segmentos.reduce((s, k) => s + dados[k].totalVenda, 0);

  let angulo = 0;
  const fatias = segmentos.map((k) => {
    const parte = total > 0 ? (dados[k].totalVenda / total) * Math.PI * 2 : 0;
    const f = { k, inicio: angulo, fim: angulo + parte, parte };
    angulo += parte;
    return f;
  });
  const mostrar = foco ? [foco] : segmentos;

  function clicar(k: SegmentoLiotNg) {
    if (expandido && foco === k) {
      setExpandido(false);
      setFoco(null);
      return;
    }
    setFoco(k);
    setExpandido(true);
  }

  return (
    <div className="mb-8 rounded-2xl border border-brand-border bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-extrabold text-brand-navy-2">Vendas por segmento — LIOT x NG</p>
          <p className="text-[12px] text-brand-faint">LIOT: propostas dos módulos QRH e KPH · NG: todos os outros módulos</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setExpandido((v) => !v);
            setFoco(null);
          }}
          aria-expanded={expandido}
          className="flex h-9 items-center gap-1.5 rounded-[10px] border border-brand-border bg-white px-3.5 text-[13px] font-semibold text-brand-navy-2 hover:bg-brand-hover"
        >
          {expandido ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {expandido ? "Recolher" : "Expandir"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
        <svg viewBox="0 0 180 180" className="h-[180px] w-[180px] shrink-0" role="img" aria-label="Pizza de vendas LIOT x NG">
          {total === 0 ? (
            <circle cx={CENTRO} cy={CENTRO} r={RAIO} fill="#eef1f5" />
          ) : (
            fatias.map(({ k, inicio, fim, parte }) =>
              parte <= 0 ? null : parte >= Math.PI * 2 - 1e-6 ? (
                <circle
                  key={k}
                  cx={CENTRO}
                  cy={CENTRO}
                  r={RAIO}
                  fill={SEGMENTO_CONFIG[k].cor}
                  className="cursor-pointer"
                  onClick={() => clicar(k)}
                />
              ) : (
                <path
                  key={k}
                  d={caminhoFatia(inicio, fim)}
                  fill={SEGMENTO_CONFIG[k].cor}
                  stroke="#fff"
                  strokeWidth={2}
                  className="cursor-pointer transition-opacity hover:opacity-85"
                  opacity={foco && foco !== k ? 0.45 : 1}
                  onClick={() => clicar(k)}
                >
                  <title>
                    {SEGMENTO_CONFIG[k].label}: {moeda(dados[k].totalVenda)} ({percentual(dados[k].totalVenda, total)})
                  </title>
                </path>
              )
            )
          )}
        </svg>

        <div className="min-w-[260px] flex-1 space-y-2.5">
          {segmentos.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => clicar(k)}
              className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors ${
                foco === k ? "border-brand-accent bg-brand-accent-soft/40" : "border-brand-border hover:bg-brand-hover"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: SEGMENTO_CONFIG[k].cor }} />
                <span>
                  <span className="block text-[13.5px] font-extrabold text-brand-navy-2">{SEGMENTO_CONFIG[k].label}</span>
                  <span className="block text-[11.5px] text-brand-faint">{SEGMENTO_CONFIG[k].descricao}</span>
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[16px] font-extrabold text-brand-navy-2">{moeda(dados[k].totalVenda)}</span>
                <span className="block text-[11.5px] text-brand-faint">{percentual(dados[k].totalVenda, total)} do total de venda</span>
              </span>
            </button>
          ))}
          {!expandido && <p className="text-[11.5px] text-brand-faint">Clique numa fatia ou em “Expandir” para ver total de venda, vendido e recebido.</p>}
        </div>
      </div>

      {expandido && (
        <div className={`mt-5 grid gap-4 ${mostrar.length > 1 ? "md:grid-cols-2" : ""}`}>
          {mostrar.map((k) => (
            <Degraus key={k} r={dados[k]} />
          ))}
        </div>
      )}
    </div>
  );
}
