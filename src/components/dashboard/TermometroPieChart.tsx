"use client";

import { TERMOMETRO_CONFIG, TERMOMETRO_ORDEM } from "@/lib/constants";
import type { Termometro } from "@/types";

function polarParaCartesiano(cx: number, cy: number, r: number, anguloGraus: number) {
  const rad = ((anguloGraus - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function fatiaPath(cx: number, cy: number, r: number, anguloInicio: number, anguloFim: number) {
  const inicio = polarParaCartesiano(cx, cy, r, anguloFim);
  const fim = polarParaCartesiano(cx, cy, r, anguloInicio);
  const largeArcFlag = anguloFim - anguloInicio <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${inicio.x} ${inicio.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${fim.x} ${fim.y} Z`;
}

export function TermometroPieChart({
  contagem,
  selecionado,
  onSelecionar,
}: {
  contagem: Record<Termometro, number>;
  selecionado: Termometro | null;
  onSelecionar: (status: Termometro | null) => void;
}) {
  const total = TERMOMETRO_ORDEM.reduce((acc, t) => acc + contagem[t], 0);
  const cx = 60;
  const cy = 60;
  const r = 54;

  const fatias = TERMOMETRO_ORDEM.filter((t) => contagem[t] > 0).reduce<
    { status: Termometro; anguloInicio: number; anguloFim: number }[]
  >((acc, t) => {
    const anguloInicio = acc.length > 0 ? acc[acc.length - 1].anguloFim : 0;
    const anguloFim = anguloInicio + (contagem[t] / total) * 360;
    return [...acc, { status: t, anguloInicio, anguloFim }];
  }, []);

  function alternar(status: Termometro) {
    onSelecionar(selecionado === status ? null : status);
  }

  return (
    <div className="flex items-center gap-4">
      <svg width={120} height={120} viewBox="0 0 120 120" className="shrink-0">
        {total === 0 && <circle cx={cx} cy={cy} r={r} fill="#eef1f8" />}
        {total > 0 && fatias.length === 1 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill={TERMOMETRO_CONFIG[fatias[0].status].text}
            opacity={selecionado && selecionado !== fatias[0].status ? 0.35 : 1}
            className="cursor-pointer transition-opacity"
            onClick={() => alternar(fatias[0].status)}
          />
        )}
        {total > 0 &&
          fatias.length > 1 &&
          fatias.map((f) => (
            <path
              key={f.status}
              d={fatiaPath(cx, cy, r, f.anguloInicio, f.anguloFim)}
              fill={TERMOMETRO_CONFIG[f.status].text}
              opacity={selecionado && selecionado !== f.status ? 0.35 : 1}
              stroke="#fff"
              strokeWidth={1.5}
              className="cursor-pointer transition-opacity"
              onClick={() => alternar(f.status)}
            />
          ))}
      </svg>
      <div className="flex flex-col gap-1">
        {TERMOMETRO_ORDEM.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => alternar(t)}
            className={`flex items-center gap-2 rounded-md px-2 py-1 text-left text-[12.5px] transition-colors ${
              selecionado === t ? "bg-brand-hover" : "hover:bg-brand-hover"
            }`}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: TERMOMETRO_CONFIG[t].text }}
            />
            <span className="text-brand-navy-2">{TERMOMETRO_CONFIG[t].label}</span>
            <span className="ml-auto font-bold text-brand-navy-2">{contagem[t]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
