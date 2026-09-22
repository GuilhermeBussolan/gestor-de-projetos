"use client";

import { Modal } from "@/components/ui/Modal";
import type { LinhaClienteMes } from "@/lib/faturamentoPrevisto";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function labelMes(mes: string): string {
  const [ano, m] = mes.split("-");
  const nomes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${nomes[Number(m) - 1]} de ${ano}`;
}

/**
 * Só uma visualização — o relatório exportável (CSV/PDF) é a matriz anual, no topo da página,
 * porque "Total Previsto do ano" não faz sentido escopado a um mês só.
 */
export function DetalheMesFaturamentoModal({
  mes,
  linhas,
  onClose,
}: {
  mes: string | null;
  linhas: LinhaClienteMes[];
  onClose: () => void;
}) {
  const totalMes = linhas.reduce((s, l) => s + l.totalMes, 0);

  return (
    <Modal open={!!mes} onClose={onClose} title={mes ? `Faturamento previsto — ${labelMes(mes)}` : ""} extraWide>
      {mes && (
        <div>
          <p className="mb-4 text-sm text-brand-muted">
            Total do mês: <strong className="text-brand-navy-2">{moeda(totalMes)}</strong>
          </p>

          <div className="space-y-4">
            {linhas.map((l) => (
              <div key={l.clienteId} className="rounded-2xl border border-brand-border bg-white p-4 shadow-card">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[14px] font-extrabold text-brand-navy-2">{l.cliente}</p>
                  <div className="flex flex-wrap gap-4 text-[12px] text-brand-muted">
                    <span>
                      Valor venda: <strong className="text-brand-navy-2">{moeda(l.valorVenda)}</strong>
                    </span>
                    <span>
                      Faturado: <strong className="text-brand-navy-2">{moeda(l.faturado)}</strong>
                    </span>
                    <span>
                      Saldo: <strong className="text-brand-navy-2">{moeda(l.saldo)}</strong>
                    </span>
                    <span>
                      Total no mês: <strong className="text-brand-accent">{moeda(l.totalMes)}</strong>
                    </span>
                  </div>
                </div>
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-brand-border-soft text-left text-[10.5px] font-bold tracking-[.08em] text-brand-faint uppercase">
                      <th className="py-1.5">Projeto</th>
                      <th className="py-1.5">Identificação</th>
                      <th className="py-1.5">Situação</th>
                      <th className="py-1.5 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.itens.map((it, i) => (
                      <tr key={i} className="border-b border-brand-border-soft last:border-b-0">
                        <td className="py-1.5 text-brand-muted">{it.codigoProposta}</td>
                        <td className="py-1.5 text-brand-navy-2">{it.identificacao}</td>
                        <td className="py-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              it.tipo === "liberado" ? "bg-[#e3f5ea] text-[#15754c]" : "bg-[#e8efff] text-[#2456b8]"
                            }`}
                          >
                            {it.tipo === "liberado" ? "Liberado" : "Previsto"}
                          </span>
                        </td>
                        <td className="py-1.5 text-right font-bold text-brand-navy-2">{moeda(it.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {linhas.length === 0 && (
              <p className="rounded-2xl border border-dashed border-brand-border bg-white p-8 text-center text-brand-faint">
                Nenhum lançamento previsto para esse filtro neste mês.
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
