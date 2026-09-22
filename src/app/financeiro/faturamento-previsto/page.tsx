"use client";

import { useMemo, useState } from "react";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { FinanceiroTabs } from "@/components/layout/FinanceiroTabs";
import { Button } from "@/components/ui/Button";
import { FormRow, Select } from "@/components/ui/Field";
import { GraficoFaturamentoBarras, LegendaFaturamento } from "@/components/financeiro/GraficoFaturamentoBarras";
import { DetalheMesFaturamentoModal } from "@/components/financeiro/DetalheMesFaturamentoModal";
import { TIPO_FATURAMENTO_CONFIG, TIPO_FATURAMENTO_ORDEM } from "@/lib/constants";
import { nomeExibicaoCliente } from "@/lib/cliente";
import {
  detalheDoMes,
  exportarMatrizCsv,
  exportarMatrizPdf,
  filtrarItens,
  matrizAnual,
  montarItensFaturamento,
  totaisPorMes,
  totalDoAno,
  type FiltrosFaturamento,
} from "@/lib/faturamentoPrevisto";
import type { Cliente, Projeto, TipoFaturamento } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ANO_ATUAL = new Date().getFullYear();
const ANOS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];

function FaturamentoPrevistoPageContent() {
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");

  const [ano, setAno] = useState(ANO_ATUAL);
  const [clienteId, setClienteId] = useState("");
  const [tipoFaturamento, setTipoFaturamento] = useState<"" | TipoFaturamento>("");
  const [mesAberto, setMesAberto] = useState<string | null>(null);

  const filtros: FiltrosFaturamento = useMemo(() => ({ clienteId, tipoFaturamento }), [clienteId, tipoFaturamento]);

  const todosItens = useMemo(() => montarItensFaturamento(projetos, clientes, ano), [projetos, clientes, ano]);
  const itens = useMemo(() => filtrarItens(todosItens, filtros), [todosItens, filtros]);
  const totais = useMemo(() => totaisPorMes(itens, ano), [itens, ano]);
  const total = totalDoAno(totais);
  const matriz = useMemo(() => matrizAnual(itens, projetos), [itens, projetos]);

  const linhasDoMes = useMemo(
    () => (mesAberto ? detalheDoMes(itens, projetos, mesAberto) : []),
    [itens, projetos, mesAberto]
  );

  const clientesComItem = useMemo(() => {
    const ids = new Set(todosItens.map((i) => i.clienteId));
    return clientes.filter((c) => ids.has(c.id)).sort((a, b) => nomeExibicaoCliente(a).localeCompare(nomeExibicaoCliente(b)));
  }, [todosItens, clientes]);

  return (
    <div>
      <FinanceiroTabs />
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Faturamento Previsto</h1>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={matriz.length === 0} onClick={() => exportarMatrizCsv(matriz, ano)}>
            Exportar CSV
          </Button>
          <Button variant="secondary" disabled={matriz.length === 0} onClick={() => exportarMatrizPdf(matriz, ano)}>
            Exportar PDF
          </Button>
        </div>
      </div>
      <p className="mb-5 text-sm text-brand-muted">
        Parcelas e marcos já liberados (verde) e ainda previstos (azul), mês a mês. Clique numa
        barra para ver o detalhe por cliente.
      </p>

      <div className="mb-5 flex flex-wrap items-end gap-2.5">
        <div className="w-28 shrink-0">
          <FormRow label="Ano">
            <Select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {ANOS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </FormRow>
        </div>
        <div className="w-56 shrink-0">
          <FormRow label="Cliente">
            <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Todos</option>
              {clientesComItem.map((c) => (
                <option key={c.id} value={c.id}>
                  {nomeExibicaoCliente(c)}
                </option>
              ))}
            </Select>
          </FormRow>
        </div>
        <div className="w-52 shrink-0">
          <FormRow label="Tipo de faturamento">
            <Select value={tipoFaturamento} onChange={(e) => setTipoFaturamento(e.target.value as "" | TipoFaturamento)}>
              <option value="">Todos</option>
              {TIPO_FATURAMENTO_ORDEM.filter((t) => t !== "apontamento_horas").map((t) => (
                <option key={t} value={t}>
                  {TIPO_FATURAMENTO_CONFIG[t].label}
                </option>
              ))}
            </Select>
          </FormRow>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <LegendaFaturamento />
          <p className="text-[12.5px] text-brand-muted">
            Total previsto {ano}: <strong className="text-brand-navy-2">{moeda(total)}</strong>
          </p>
        </div>
        <GraficoFaturamentoBarras totais={totais} mesSelecionado={mesAberto} onClickMes={setMesAberto} />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-brand-hover text-left text-[10px] font-bold tracking-[.07em] whitespace-nowrap text-brand-faint uppercase">
                <th className="px-3 py-2.5">Cliente</th>
                <th className="px-3 py-2.5">Valor Venda</th>
                <th className="px-3 py-2.5">Faturado</th>
                <th className="px-3 py-2.5">Saldo</th>
                {MESES_ABREV.map((m) => (
                  <th key={m} className="px-2 py-2.5 text-right">
                    Previsto {m}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right">Total Previsto {ano}</th>
              </tr>
            </thead>
            <tbody>
              {matriz.map((l) => (
                <tr key={l.clienteId} className="border-t border-brand-border-soft whitespace-nowrap">
                  <td className="px-3 py-2 font-bold text-brand-navy-2">{l.cliente}</td>
                  <td className="px-3 py-2 text-brand-muted">{moeda(l.valorVenda)}</td>
                  <td className="px-3 py-2 text-brand-muted">{moeda(l.faturado)}</td>
                  <td className="px-3 py-2 text-brand-muted">{moeda(l.saldo)}</td>
                  {l.previstoPorMes.map((v, i) => (
                    <td key={i} className="px-2 py-2 text-right text-brand-muted">
                      {v > 0 ? moeda(v) : "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-bold text-brand-navy-2">{moeda(l.totalPrevistoAno)}</td>
                </tr>
              ))}
              {matriz.length === 0 && (
                <tr>
                  <td colSpan={16} className="px-4 py-8 text-center text-brand-faint">
                    Nenhum lançamento previsto para esse filtro em {ano}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DetalheMesFaturamentoModal mes={mesAberto} linhas={linhasDoMes} onClose={() => setMesAberto(null)} />
    </div>
  );
}

export default function FaturamentoPrevistoPage() {
  return (
    <ProtectedPage perfis={["administrador", "financeiro"]}>
      <FaturamentoPrevistoPageContent />
    </ProtectedPage>
  );
}
