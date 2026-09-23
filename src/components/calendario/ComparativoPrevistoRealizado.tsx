"use client";

import { AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";
import { MENSAGEM_CENARIO, type ComparativoGrupo } from "@/lib/comparativoHoras";
import { formatarHoras } from "@/lib/horas";

const ESTILO_CENARIO: Record<ComparativoGrupo["cenario"], { bg: string; text: string; Icone: typeof AlertTriangle }> = {
  abaixo: { bg: "#fff2de", text: "#a4650d", Icone: TrendingDown },
  dentro: { bg: "#e3f5ea", text: "#15754c", Icone: CheckCircle2 },
  acima: { bg: "#fdeceb", text: "#b5392a", Icone: AlertTriangle },
};

/** Seção 5: compara Previsto x Realizado de cada grupo de rotina tocado por este apontamento. */
export function ComparativoPrevistoRealizado({ grupos }: { grupos: ComparativoGrupo[] }) {
  if (grupos.length === 0) return null;
  return (
    <div className="space-y-2">
      {grupos.map((g) => {
        const cfg = ESTILO_CENARIO[g.cenario];
        const Icone = cfg.Icone;
        const finalizadoAntes = g.concluido && g.diferenca < -0.01;
        const mensagem = finalizadoAntes
          ? `Tarefa marcada como concluída em ${formatarHoras(g.horasRealizadas)}, menos que o previsto (${formatarHoras(g.horasPrevistas)}).`
          : MENSAGEM_CENARIO[g.cenario];
        return (
          <div key={g.grupoId} className="rounded-md p-3" style={{ backgroundColor: cfg.bg }}>
            <div className="flex items-start gap-2">
              <Icone size={16} style={{ color: cfg.text }} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold" style={{ color: cfg.text }}>
                  {mensagem}
                </p>
                <p className="mt-1 text-[11.5px] text-brand-muted">
                  Grupo <strong className="text-brand-navy-2">{g.descricao}</strong> · Previsto:{" "}
                  <strong>{formatarHoras(g.horasPrevistas)}</strong> · Realizado (com este):{" "}
                  <strong>{formatarHoras(g.horasRealizadas)}</strong> · Diferença:{" "}
                  <strong>{formatarHoras(Math.abs(g.diferenca))}</strong>
                </p>
                {g.excedeu20 && (
                  <p className="mt-1 text-[11px] font-semibold" style={{ color: cfg.text }}>
                    ⚠ Excedente acima de 20% das horas previstas do grupo.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
