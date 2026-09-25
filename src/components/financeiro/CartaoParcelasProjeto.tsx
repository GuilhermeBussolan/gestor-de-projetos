"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PeriodoBadge } from "@/components/projetos/PeriodoBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { STATUS_PARCELA_CONFIG, STATUS_PARCELA_ORDEM, TIPO_FATURAMENTO_CONFIG } from "@/lib/constants";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { formatarHorasDecimais, parcelaDoMes, resumoBancoDeHoras, rotuloMes, valorDoBancoDeHoras } from "@/lib/bancoHoras";
import type { Cliente, Projeto, StatusParcela } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Banco de horas: as horas apontadas no mês de referência e a ação de gerar a parcela do mês. */
export interface BancoDeHorasDoMes {
  mes: string;
  horas: number;
  onGerarParcela: (valor: number) => Promise<void>;
}

/**
 * Card de um projeto na tela do Financeiro. Recolhido mostra só o essencial (cliente, código do
 * cliente, proposta, valor e um resumo das parcelas por status); aberto mostra cada parcela, com o
 * seletor de status. No banco de horas mostra também o cálculo do mês (horas × valor hora).
 */
export function CartaoParcelasProjeto({
  projeto: p,
  cliente,
  aberto,
  banco,
  onAlternar,
  onMudarStatus,
}: {
  projeto: Projeto;
  cliente: Cliente | undefined;
  aberto: boolean;
  banco?: BancoDeHorasDoMes;
  onAlternar: () => void;
  onMudarStatus: (projeto: Projeto, numero: number, status: StatusParcela) => void;
}) {
  const porApontamento = p.financeiro?.tipoFaturamento === "apontamento_horas";
  const ehBanco = p.financeiro?.tipoFaturamento === "banco_horas";
  const parcelas = p.financeiro?.parcelas ?? [];
  const resumo = STATUS_PARCELA_ORDEM.map((s) => ({ status: s, qtd: parcelas.filter((x) => x.status === s).length })).filter((x) => x.qtd > 0);

  const valorHora = p.financeiro?.valorHora ?? 0;
  const sugerido = banco ? valorDoBancoDeHoras(banco.horas, valorHora) : 0;
  const [valorEditado, setValorEditado] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const valorAFaturar = valorEditado ?? String(sugerido);
  const parcelaExistente = banco ? parcelaDoMes(p, banco.mes) : undefined;

  async function gerar() {
    if (!banco) return;
    const valor = Number(valorAFaturar.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro("Informe um valor a faturar maior que zero.");
      return;
    }
    setGerando(true);
    setErro("");
    try {
      await banco.onGerarParcela(valor);
      setValorEditado(null);
    } catch (err) {
      console.error("Erro ao gerar a parcela do banco de horas:", err);
      setErro("Não foi possível gerar a parcela. Tente novamente.");
    } finally {
      setGerando(false);
    }
  }

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
          {ehBanco && banco && valorHora > 0 && (
            <p className="mt-1 text-[12.5px] text-brand-navy-2">
              <strong>{formatarHorasDecimais(banco.horas)}</strong> em {rotuloMes(banco.mes)} · Valor hora: {moeda(valorHora)} ·{" "}
              <strong>Total: {moeda(sugerido)}</strong>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {!aberto && !porApontamento && resumo.length > 0 && (
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
          {ehBanco ? (
            <span className="text-[13px] font-extrabold whitespace-nowrap text-brand-navy-2">Venda {moeda(p.financeiro?.valorVenda ?? 0)}</span>
          ) : (
            !porApontamento && (
              <span className="text-[15px] font-extrabold whitespace-nowrap text-brand-navy-2">
                {moeda(p.financeiro?.valorTotal ?? 0)} · {p.financeiro?.numeroParcelas ?? 0}x
              </span>
            )
          )}
          <ChevronDown size={18} className={`shrink-0 text-brand-faint transition-transform ${aberto ? "rotate-180" : ""}`} />
        </div>
      </button>

      {aberto && (
        <div className="space-y-4 border-t border-brand-border-soft px-5 pt-4 pb-5">
          {ehBanco && banco && (
            <div className="rounded-xl border border-brand-accent/30 bg-brand-accent-soft/40 p-4">
              <p className="text-[11px] font-bold tracking-[.08em] text-brand-faint uppercase">Faturamento de {rotuloMes(banco.mes)}</p>
              {valorHora <= 0 ? (
                <p className="mt-1 text-[13px] text-[#b5392a]">Este projeto não tem valor hora cadastrado. Edite o projeto para informar.</p>
              ) : (
                <>
                  <p className="mt-1 text-[14px] font-bold text-brand-navy-2">{resumoBancoDeHoras(banco.horas, valorHora)}</p>
                  <p className="text-[12px] text-brand-muted">
                    Horas aprovadas do projeto em {rotuloMes(banco.mes)} (todos os recursos). O valor abaixo é a sugestão e pode ser editado.
                  </p>
                  {parcelaExistente ? (
                    <p className="mt-3 rounded-md bg-[#e3f5ea] px-3 py-2 text-[12.5px] text-[#15754c]">
                      Já existe a parcela {parcelaExistente.numero} deste mês ({moeda(parcelaExistente.valor)}). Acompanhe o status abaixo.
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-end gap-2.5">
                      <div>
                        <label className="mb-1 block text-[12px] font-bold text-brand-navy-2">Valor a faturar (R$)</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={valorAFaturar}
                          onChange={(e) => setValorEditado(e.target.value)}
                          className="w-44"
                        />
                      </div>
                      {valorEditado !== null && Number(valorEditado) !== sugerido && (
                        <button type="button" onClick={() => setValorEditado(null)} className="mb-2.5 text-[12.5px] font-semibold text-brand-accent hover:underline">
                          Voltar ao sugerido ({moeda(sugerido)})
                        </button>
                      )}
                      <Button type="button" onClick={gerar} disabled={gerando || (banco.horas <= 0 && valorEditado === null)}>
                        {gerando ? "Gerando..." : "Gerar parcela do mês"}
                      </Button>
                    </div>
                  )}
                  {erro && <p className="mt-2 text-[12.5px] font-semibold text-red-600">{erro}</p>}
                </>
              )}
            </div>
          )}

          {porApontamento ? (
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
