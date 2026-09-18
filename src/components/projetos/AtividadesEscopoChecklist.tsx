"use client";

import {
  alternarAtividadeMarcada,
  estadoMarcacao,
  formatarDataCurta,
  nivelAtividade,
  temFilhos,
} from "@/lib/escopo";
import type { EscopoAtividade } from "@/types";

export function AtividadesEscopoChecklist({
  atividades,
  marcadas,
  onChange,
  datas,
  className = "max-h-40",
}: {
  atividades: EscopoAtividade[];
  marcadas: string[];
  onChange: (marcadas: string[]) => void;
  /** Datas em que cada atividade já foi apontada (aprovadas). */
  datas?: Map<string, string[]>;
  className?: string;
}) {
  const set = new Set(marcadas);
  return (
    <div className={`${className} space-y-1 overflow-y-auto rounded-md border border-brand-border p-2`}>
      {atividades.map((a, i) => {
        const estado = estadoMarcacao(atividades, set, i);
        const pai = temFilhos(atividades, i);
        const feitoEm = datas?.get(a.id) ?? [];
        return (
          <div key={a.id} style={{ paddingLeft: nivelAtividade(a) * 18 }}>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 shrink-0"
                checked={estado === "marcada"}
                ref={(el) => {
                  if (el) el.indeterminate = estado === "parcial";
                }}
                onChange={() => onChange(alternarAtividadeMarcada(atividades, marcadas, a.id))}
              />
              <span className={pai ? "font-bold text-brand-navy-2" : "text-brand-navy-2"}>{a.descricao}</span>
            </label>
            {feitoEm.length > 0 && (
              <p className="pl-6 text-[11px] text-[#15754c]">
                Feito em: {feitoEm.map(formatarDataCurta).join(", ")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
