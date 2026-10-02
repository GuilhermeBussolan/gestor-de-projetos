"use client";

import { useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { PeriodoBadge } from "@/components/projetos/PeriodoBadge";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { STATUS_PARCELA_CONFIG, STATUS_PARCELA_ORDEM, TIPO_FATURAMENTO_CONFIG } from "@/lib/constants";
import { nomeExibicaoCliente } from "@/lib/cliente";
import {
  formatarHorasDecimais,
  parcelaDoMes,
  resumoBancoDeHoras,
  rotuloMes,
  valorDoBancoDeHoras,
  type FaturamentoAnteriorBanco,
} from "@/lib/bancoHoras";
import type { Cliente, Projeto, StatusParcela } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Banco de horas: as horas apontadas no mês de referência e a ação de gerar a parcela do mês. */
export interface BancoDeHorasDoMes {
  mes: string;
  horas: number;
  /** Horas do projeto em outros meses/status, para explicar um mês zerado. */
  outrasHoras?: string[];
  onGerarParcela: (valor: number) => Promise<void>;
  /** Lançar um faturamento de meses anteriores (antes do sistema), já faturado ou recebido. */
  onLancarAnterior: (dados: FaturamentoAnteriorBanco) => Promise<void>;
}

const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const ANTERIOR_VAZIO = { mes: "", valor: "", horas: "", status: "FATURADO" as FaturamentoAnteriorBanco["status"], dataFaturamento: "", notaFiscal: "", dataRecebimento: "" };

/** Formulário para incluir o valor de um faturamento anterior do banco de horas (com as datas, como nos parcelados). */
function FaturamentoAnterior({ projeto, banco }: { projeto: Projeto; banco: BancoDeHorasDoMes }) {
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState(ANTERIOR_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const campo = (k: keyof typeof ANTERIOR_VAZIO, v: string) => setF((x) => ({ ...x, [k]: v }));
  const valorHora = projeto.financeiro?.valorHora ?? 0;
  const jaTemNoMes = f.mes ? parcelaDoMes(projeto, f.mes) : undefined;

  async function salvar() {
    setErro("");
    setOk("");
    const valor = Number(f.valor.replace(",", "."));
    const horas = f.horas.trim() ? Number(f.horas.replace(",", ".")) : null;
    if (!f.mes) return setErro("Informe o mês de referência das horas.");
    if (f.mes > hojeIso().slice(0, 7)) return setErro("O mês de referência não pode ser futuro.");
    if (!Number.isFinite(valor) || valor <= 0) return setErro("Informe o valor faturado (maior que zero).");
    if (horas !== null && (!Number.isFinite(horas) || horas < 0)) return setErro("Horas inválidas.");
    if (!f.dataFaturamento) return setErro("Informe a data do faturamento.");
    if (f.status === "RECEBIDO" && !f.dataRecebimento) return setErro("Informe a data do recebimento.");
    if (jaTemNoMes) return setErro(`Já existe a parcela ${jaTemNoMes.numero} de ${rotuloMes(f.mes)}. Para corrigir, altere essa parcela.`);
    setSalvando(true);
    try {
      await banco.onLancarAnterior({ ...f, valor, horas, status: f.status });
      setOk(`Faturamento de ${rotuloMes(f.mes)} incluído.`);
      setF(ANTERIOR_VAZIO);
    } catch (err) {
      console.error("Erro ao lançar faturamento anterior:", err);
      setErro("Não foi possível incluir. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => setAberto(true)} className="h-9 px-3 text-[12.5px]">
          <History size={14} />
          Lançar faturamento anterior
        </Button>
        <span className="text-[12px] text-brand-faint">Para meses já faturados antes do sistema (ou sem apontamento aqui).</span>
        {ok && <span className="text-[12.5px] font-semibold text-[#15754c]">{ok}</span>}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-brand-border bg-white p-4">
      <p className="flex items-center gap-1.5 text-[13px] font-bold text-brand-navy-2">
        <History size={15} className="text-brand-faint" />
        Faturamento anterior do banco de horas
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormRow label="Mês das horas">
          <Input type="month" value={f.mes} max={hojeIso().slice(0, 7)} onChange={(e) => campo("mes", e.target.value)} />
        </FormRow>
        <FormRow label="Horas (opcional)">
          <Input type="number" step="0.01" min="0" value={f.horas} onChange={(e) => campo("horas", e.target.value)} placeholder="ex.: 80" />
        </FormRow>
        <FormRow label="Valor faturado (R$)">
          <Input type="number" step="0.01" min="0" value={f.valor} onChange={(e) => campo("valor", e.target.value)} placeholder="0,00" />
        </FormRow>
        <FormRow label="Situação">
          <Select value={f.status} onChange={(e) => campo("status", e.target.value)}>
            <option value="LIBERADO">{STATUS_PARCELA_CONFIG.LIBERADO.label}</option>
            <option value="FATURADO">{STATUS_PARCELA_CONFIG.FATURADO.label}</option>
            <option value="RECEBIDO">{STATUS_PARCELA_CONFIG.RECEBIDO.label}</option>
          </Select>
        </FormRow>
        <FormRow label="Data do faturamento">
          <Input type="date" value={f.dataFaturamento} max={hojeIso()} onChange={(e) => campo("dataFaturamento", e.target.value)} />
        </FormRow>
        <FormRow label="Nota fiscal (opcional)">
          <Input value={f.notaFiscal} onChange={(e) => campo("notaFiscal", e.target.value)} placeholder="nº da NF" />
        </FormRow>
        {f.status === "RECEBIDO" && (
          <FormRow label="Data do recebimento">
            <Input type="date" value={f.dataRecebimento} max={hojeIso()} onChange={(e) => campo("dataRecebimento", e.target.value)} />
          </FormRow>
        )}
      </div>
      {f.horas.trim() && valorHora > 0 && Number(f.horas.replace(",", ".")) > 0 && (
        <p className="text-[12px] text-brand-muted">
          Pelo valor hora do projeto: {resumoBancoDeHoras(Number(f.horas.replace(",", ".")), valorHora)}.{" "}
          {f.valor === "" && (
            <button
              type="button"
              onClick={() => campo("valor", String(valorDoBancoDeHoras(Number(f.horas.replace(",", ".")), valorHora)))}
              className="font-semibold text-brand-accent hover:underline"
            >
              Usar este valor
            </button>
          )}
        </p>
      )}
      <p className="text-[11.5px] text-brand-faint">
        Entra na lista de parcelas já na situação escolhida e conta no Faturamento Previsto x Realizado pelo mês da data do faturamento.
      </p>
      {erro && <p className="text-[12.5px] font-semibold text-red-600">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={salvando}
          onClick={() => {
            setAberto(false);
            setF(ANTERIOR_VAZIO);
            setErro("");
          }}
        >
          Cancelar
        </Button>
        <Button type="button" onClick={salvar} disabled={salvando}>
          {salvando ? "Incluindo..." : "Incluir faturamento"}
        </Button>
      </div>
    </div>
  );
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
                  {banco.horas <= 0 && (
                    <p className="mt-2 rounded-md bg-[#fff2de] px-3 py-2 text-[12.5px] text-[#a4650d]">
                      {banco.outrasHoras && banco.outrasHoras.length > 0
                        ? `Sem horas aprovadas em ${rotuloMes(banco.mes)}. Horas deste projeto: ${banco.outrasHoras.join(" · ")}. Troque o mês acima se for o caso.`
                        : `Este projeto não tem nenhum apontamento (aprovado, aguardando ou previsto) no sistema.`}
                    </p>
                  )}
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

          {ehBanco && banco && <FaturamentoAnterior projeto={p} banco={banco} />}

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
