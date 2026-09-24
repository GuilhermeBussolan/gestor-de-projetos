"use client";

import { ChevronDown } from "lucide-react";
import { PeriodoBadge } from "@/components/projetos/PeriodoBadge";
import { STATUS_PARCELA_CONFIG, STATUS_PARCELA_ORDEM, TIPO_FATURAMENTO_CONFIG } from "@/lib/constants";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Cliente, Projeto, StatusParcela } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Card de um projeto na tela do Financeiro. Recolhido mostra só o essencial (cliente, código do
 * cliente, proposta, valor e um resumo das parcelas por status); aberto mostra cada parcela, com o
 * seletor de status.
 */
export function CartaoParcelasProjeto({
  projeto: p,
  cliente,
  aberto,
  onAlternar,
  onMudarStatus,
}: {
  projeto: Projeto;
  cliente: Cliente | undefined;
  aberto: boolean;
  onAlternar: () => void;
  onMudarStatus: (projeto: Projeto, numero: number, status: StatusParcela) => void;
}) {
  const porHoras = p.financeiro?.tipoFaturamento === "apontamento_horas";
  const parcelas = p.financeiro?.parcelas ?? [];
  const resumo = STATUS_PARCELA_ORDEM.map((s) => ({ status: s, qtd: parcelas.filter((x) => x.status === s).length })).filter((x) => x.qtd > 0);

  return (
    <div className="rounded-2xl border border-brand-border bg-white shadow-card">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberto}
        className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl px-5 py-3.5 text-left hover:bg-brand-hover/60"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="text-base font-extrabold tracking-[-0.02em] text-brand-navy-2">{nomeExibicaoCliente(cliente)}</p>
            {cliente?.codigoCI && (
              <span className="rounded-full bg-brand-bg px-2 py-0.5 text-[11px] font-bold text-brand-muted" title="Código do cliente">
                Cód. cliente {cliente.codigoCI}
              </span>
            )}
            <span className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-[11px] font-bold text-[#2456b8]" title="Proposta">
              Proposta {p.codigoProposta}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-brand-faint">
            <span>{TIPO_FATURAMENTO_CONFIG[p.financeiro?.tipoFaturamento ?? "parcelado"].label}</span>
            <PeriodoBadge dataInicio={p.dataInicio} dataFim={p.dataFim} className="text-[11.5px] text-brand-faint" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {!aberto && !porHoras && resumo.length > 0 && (
            <span className="flex flex-wrap gap-1.5">
              {resumo.map(({ status, qtd }) => (
                <span
                  key={status}
                  className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                  style={{ backgroundColor: STATUS_PARCELA_CONFIG[status].bg, color: STATUS_PARCELA_CONFIG[status].text }}
                >
                  {qtd} {STATUS_PARCELA_CONFIG[status].label}
                </span>
              ))}
            </span>
          )}
          {!porHoras && (
            <span className="text-[15px] font-extrabold whitespace-nowrap text-brand-navy-2">
              {moeda(p.financeiro?.valorTotal ?? 0)} · {p.financeiro?.numeroParcelas ?? 0}x
            </span>
          )}
          <ChevronDown size={18} className={`shrink-0 text-brand-faint transition-transform ${aberto ? "rotate-180" : ""}`} />
        </div>
      </button>

      {aberto && (
        <div className="border-t border-brand-border-soft px-5 pt-4 pb-5">
          {porHoras ? (
            <p className="text-sm text-brand-faint">Faturamento por apontamento de horas — sem parcelas fixas.</p>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {parcelas.map((parc) => (
                <div key={parc.numero} className="flex min-w-[190px] flex-col gap-2 rounded-xl border border-brand-border-soft bg-brand-input px-3.5 py-3">
                  <span className="text-[11.5px] text-brand-faint">{parc.descricao ? parc.descricao : `Parcela ${parc.numero}`}</span>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[14.5px] font-extrabold text-brand-navy-2">{moeda(parc.valor)}</span>
                    <select
                      value={parc.status}
                      onChange={(e) => onMudarStatus(p, parc.numero, e.target.value as StatusParcela)}
                      style={{
                        backgroundColor: STATUS_PARCELA_CONFIG[parc.status].bg,
                        color: STATUS_PARCELA_CONFIG[parc.status].text,
                      }}
                      className="rounded-full border-0 px-2.5 py-1 text-[10.5px] font-bold"
                    >
                      {STATUS_PARCELA_ORDEM.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_PARCELA_CONFIG[s].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              {parcelas.length === 0 && <p className="text-sm text-brand-faint">Nenhuma parcela cadastrada.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
