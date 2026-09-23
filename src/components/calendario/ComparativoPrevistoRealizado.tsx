"use client";

import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { MENSAGEM_CENARIO, type ComparativoBloco } from "@/lib/comparativoHoras";
import { formatarHoras } from "@/lib/horas";

const ESTILO_CENARIO: Record<ComparativoBloco["cenario"], { bg: string; text: string; Icone: typeof AlertTriangle }> = {
  andamento: { bg: "#e8efff", text: "#2456b8", Icone: Clock },
  dentro: { bg: "#e3f5ea", text: "#15754c", Icone: CheckCircle2 },
  acima: { bg: "#fdeceb", text: "#b5392a", Icone: AlertTriangle },
};

function mensagem(b: ComparativoBloco): string {
  if (b.cenario === "acima") return MENSAGEM_CENARIO.acima;
  if (b.cenario === "andamento" && b.diferenca >= -0.01) {
    return `Já atingiu o previsto (${formatarHoras(b.horasPrevistas)}). Se a atividade terminou, marque "Finalizado".`;
  }
  if (b.cenario === "andamento") {
    return `Em andamento: ${formatarHoras(b.horasRealizadas)} de ${formatarHoras(b.horasPrevistas)} (${b.percentual.toFixed(0)}%). O restante entra em um próximo apontamento.`;
  }
  if (b.diferenca < -0.01) {
    return `Marcada como finalizada em ${formatarHoras(b.horasRealizadas)}, menos que o previsto (${formatarHoras(b.horasPrevistas)}).`;
  }
  return MENSAGEM_CENARIO.dentro;
}

/** Compara Previsto x Realizado de cada atividade marcada neste apontamento (ex: "Riscos" = 8h). */
export function ComparativoPrevistoRealizado({ blocos }: { blocos: ComparativoBloco[] }) {
  if (blocos.length === 0) return null;
  return (
    <div className="space-y-2">
      {blocos.map((b) => {
        const cfg = ESTILO_CENARIO[b.cenario];
        const Icone = cfg.Icone;
        return (
          <div key={b.blocoId} className="rounded-md p-3" style={{ backgroundColor: cfg.bg }}>
            <div className="flex items-start gap-2">
              <Icone size={16} style={{ color: cfg.text }} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold" style={{ color: cfg.text }}>
                  {mensagem(b)}
                </p>
                <p className="mt-1 text-[11.5px] text-brand-muted">
                  <strong className="text-brand-navy-2">{b.descricao}</strong> · Previsto:{" "}
                  <strong>{formatarHoras(b.horasPrevistas)}</strong> · Realizado (com este):{" "}
                  <strong>{formatarHoras(b.horasRealizadas)}</strong> · Diferença:{" "}
                  <strong>{formatarHoras(Math.abs(b.diferenca))}</strong>
                </p>
                {b.excedeu20 && (
                  <p className="mt-1 text-[11px] font-semibold" style={{ color: cfg.text }}>
                    ⚠ Excedente acima de 20% das horas previstas.
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
