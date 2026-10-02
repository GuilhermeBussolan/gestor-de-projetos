"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useCollection } from "@/lib/useCollection";
import { useProjetos } from "@/lib/dadosProtegidos";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { FinanceiroTabs } from "@/components/layout/FinanceiroTabs";
import { Button } from "@/components/ui/Button";
import { FormRow, Select } from "@/components/ui/Field";
import { ThOrdenavel, useOrdenacao } from "@/components/ui/Ordenacao";
import { GraficoFaturamentoBarras, LegendaFaturamento } from "@/components/financeiro/GraficoFaturamentoBarras";
import { DetalheMesFaturamentoModal } from "@/components/financeiro/DetalheMesFaturamentoModal";
import { TIPO_FATURAMENTO_CONFIG, TIPO_FATURAMENTO_ORDEM } from "@/lib/constants";
import { nomeExibicaoCliente } from "@/lib/cliente";
import {
  anosComDados,
  detalheDoMes,
  exportarMatrizCsv,
  exportarMatrizPdf,
  filtrarItens,
  lancamentosComDataInvalida,
  matrizAnual,
  mesesComDados,
  montarItensFaturamento,
  rotuloMes,
  rotuloMesAno,
  sufixoAno,
  TIPOS_ITEM_ORDEM,
  TIPO_ITEM_CONFIG,
  totaisDaMatriz,
  totaisDoAnoPorTipo,
  totaisPorMes,
  totalDoAno,
  type AnoFiltro,
  type FiltrosFaturamento,
  type TipoItemFaturamento,
} from "@/lib/faturamentoPrevisto";
import type { Cliente, Projeto, TipoFaturamento } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ANO_ATUAL = new Date().getFullYear();
const TIPOS_COLUNA = ["liberado", "faturado", "recebido", "cancelado"] as const;

/** Meses agrupados por ano, para a faixa de anos acima dos meses no cabeçalho da tabela. */
function gruposPorAno(meses: string[]): { ano: string; quantidade: number }[] {
  const grupos: { ano: string; quantidade: number }[] = [];
  meses.forEach((m) => {
    const ano = m.slice(0, 4);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.ano === ano) ultimo.quantidade += 1;
    else grupos.push({ ano, quantidade: 1 });
  });
  return grupos;
}

function FaturamentoPrevistoPageContent() {
  const { data: projetos } = useProjetos();
  const { data: clientes } = useCollection<Cliente>("clientes");

  const [ano, setAno] = useState<AnoFiltro>(ANO_ATUAL);
  const [clienteId, setClienteId] = useState("");
  const [tipoFaturamento, setTipoFaturamento] = useState<"" | TipoFaturamento>("");
  const [status, setStatus] = useState<"" | TipoItemFaturamento>("");
  const [mesAberto, setMesAberto] = useState<string | null>(null);
  // Aviso das parcelas fora do relatório: oculto por padrão (muitas ainda não têm data); o ícone ao lado das exportações abre.
  const [avisoAberto, setAvisoAberto] = useState(false);

  const filtros: FiltrosFaturamento = useMemo(() => ({ clienteId, tipoFaturamento, status }), [clienteId, tipoFaturamento, status]);

  // Tudo, de todos os anos: alimenta o filtro de ano e, recortado, o ano escolhido.
  const itensTodosAnos = useMemo(() => montarItensFaturamento(projetos, clientes, "todos"), [projetos, clientes]);
  const anos = useMemo(() => anosComDados(itensTodosAnos, ANO_ATUAL), [itensTodosAnos]);
  const datasInvalidas = useMemo(() => lancamentosComDataInvalida(projetos, clientes), [projetos, clientes]);
  const todosItens = useMemo(
    () => (ano === "todos" ? itensTodosAnos : itensTodosAnos.filter((i) => i.mes.startsWith(`${ano}-`))),
    [itensTodosAnos, ano]
  );
  const itens = useMemo(() => filtrarItens(todosItens, filtros), [todosItens, filtros]);
  const totais = useMemo(() => totaisPorMes(itens, ano), [itens, ano]);
  const total = totalDoAno(totais);
  const totaisPorTipo = useMemo(() => totaisDoAnoPorTipo(totais), [totais]);

  // Colunas de meses da tabela: do primeiro ao último mês com dados (com os filtros atuais), atravessando anos.
  const meses = useMemo(() => mesesComDados(itens), [itens]);
  const grupos = useMemo(() => gruposPorAno(meses), [meses]);
  const matriz = useMemo(() => matrizAnual(itens, projetos, meses), [itens, projetos, meses]);
  const totaisTabela = useMemo(() => totaisDaMatriz(matriz, meses.length), [matriz, meses.length]);
  // Colunas dos meses mudam com o filtro, então não são ordenáveis; as fixas e o total sim.
  const { ordenados: matrizOrdenada, ordem, ordenar } = useOrdenacao(matriz, {
    cliente: (l) => l.cliente,
    valorVenda: (l) => l.valorVenda,
    realizado: (l) => l.realizado,
    saldo: (l) => l.saldo,
    liberado: (l) => l.porTipo.liberado,
    faturado: (l) => l.porTipo.faturado,
    recebido: (l) => l.porTipo.recebido,
    cancelado: (l) => l.porTipo.cancelado,
    totalPrevisto: (l) => l.totalPrevisto,
  });
  const sufixo = sufixoAno(ano);
  const inicioDeAno = (i: number) => i === 0 || meses[i].slice(0, 4) !== meses[i - 1].slice(0, 4);

  const linhasDoMes = useMemo(
    () => (mesAberto ? detalheDoMes(itens, projetos, mesAberto) : []),
    [itens, projetos, mesAberto]
  );

  const clientesComItem = useMemo(() => {
    const ids = new Set(todosItens.map((i) => i.clienteId));
    return clientes.filter((c) => ids.has(c.id)).sort((a, b) => nomeExibicaoCliente(a).localeCompare(nomeExibicaoCliente(b)));
  }, [todosItens, clientes]);

  const rotuloPeriodo =
    ano !== "todos" ? String(ano) : meses.length > 0 ? `${rotuloMesAno(meses[0])} a ${rotuloMesAno(meses[meses.length - 1])}` : "todo o período";

  // Classes das colunas fixas (Cliente fica "grudada" à esquerda ao rolar os meses).
  const colCliente = "sticky left-0 z-10 min-w-[180px] border-r border-brand-border-soft";

  return (
    <div>
      <FinanceiroTabs />
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Faturamento Previsto x Realizado</h1>
        <div className="flex gap-2">
          {datasInvalidas.length > 0 && (
            <button
              type="button"
              onClick={() => setAvisoAberto((v) => !v)}
              aria-pressed={avisoAberto}
              aria-label={`${datasInvalidas.length} parcelas fora do relatório`}
              title={avisoAberto ? "Ocultar as parcelas fora do relatório" : `Ver as ${datasInvalidas.length} parcelas que ficaram fora do relatório (sem data ou com data inválida)`}
              className={`relative flex h-10 w-10 items-center justify-center rounded-[10px] border transition-colors ${
                avisoAberto ? "border-[#e0a84a] bg-[#fff2de] text-[#a4650d]" : "border-brand-border bg-white text-[#c07a12] hover:bg-brand-hover"
              }`}
            >
              <AlertTriangle size={17} />
              <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#c07a12] px-1 text-[10px] font-bold text-white">
                {datasInvalidas.length}
              </span>
            </button>
          )}
          <Button variant="secondary" disabled={matriz.length === 0} onClick={() => exportarMatrizCsv(matriz, ano, meses)}>
            Exportar CSV
          </Button>
          <Button variant="secondary" disabled={matriz.length === 0} onClick={() => exportarMatrizPdf(matriz, ano, meses)}>
            Exportar PDF
          </Button>
        </div>
      </div>
      <p className="mb-5 text-sm text-brand-muted">
        Parcelas e marcos mês a mês pela liberação do faturamento: o que já foi liberado entra no mês da liberação; o que ainda não foi, no mês previsto para liberar.
        Clique numa barra para ver o detalhe por cliente.
      </p>

      <div className="mb-5 flex flex-wrap items-end gap-2.5">
        <div className="w-28 shrink-0">
          <FormRow label="Ano">
            <Select value={String(ano)} onChange={(e) => setAno(e.target.value === "todos" ? "todos" : Number(e.target.value))}>
              <option value="todos">Todos</option>
              {anos.map((a) => (
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
        <div className="w-44 shrink-0">
          <FormRow label="Situação">
            <Select value={status} onChange={(e) => setStatus(e.target.value as "" | TipoItemFaturamento)}>
              <option value="">Todas</option>
              {TIPOS_ITEM_ORDEM.map((t) => (
                <option key={t} value={t}>
                  {TIPO_ITEM_CONFIG[t].label}
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

      {avisoAberto && datasInvalidas.length > 0 && (
        <div className="mb-5 rounded-xl border border-[#f3d19b] bg-[#fff8ec] px-4 py-3 text-[12.5px] text-[#8a5a0b]">
          <p className="font-bold">
            {datasInvalidas.length === 1 ? "1 parcela ficou" : `${datasInvalidas.length} parcelas ficaram`} fora deste relatório (
            {moeda(datasInvalidas.reduce((s, d) => s + d.valor, 0))}). Ajuste a data no financeiro do projeto:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {datasInvalidas.slice(0, 10).map((d, i) => (
              <li key={`${d.projetoId}-${i}`}>
                {d.cliente} — proposta {d.codigoProposta} · {d.identificacao} · {moeda(d.valor)} ·{" "}
                {d.motivo === "sem_liberacao" ? (
                  <strong>liberada sem a data da liberação</strong>
                ) : d.motivo === "sem_previsao" ? (
                  <strong>sem previsão de liberação</strong>
                ) : (
                  <>
                    data inválida: <strong>{d.data}</strong>
                  </>
                )}
              </li>
            ))}
            {datasInvalidas.length > 10 && <li>e mais {datasInvalidas.length - 10}…</li>}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <LegendaFaturamento totais={totaisPorTipo} />
          <p className="text-[12.5px] text-brand-muted">
            Total programado {ano === "todos" ? `(${rotuloPeriodo})` : ano} (sem cancelados): <strong className="text-brand-navy-2">{moeda(total)}</strong>
          </p>
        </div>
        <GraficoFaturamentoBarras totais={totais} mesSelecionado={mesAberto} onClickMes={setMesAberto} />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
        {meses.length > 0 && (
          <p className="border-b border-brand-border-soft px-4 py-2 text-[12px] text-brand-muted">
            Previsto por mês de <strong className="text-brand-navy-2">{rotuloMesAno(meses[0])}</strong> a{" "}
            <strong className="text-brand-navy-2">{rotuloMesAno(meses[meses.length - 1])}</strong>
            {meses.length > 12 ? " — role para o lado para ver todos os meses" : ""}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-brand-hover text-left text-[10px] font-bold tracking-[.07em] whitespace-nowrap text-brand-faint uppercase">
                <ThOrdenavel chave="cliente" ordem={ordem} onOrdenar={ordenar} rowSpan={2} className={`${colCliente} bg-brand-hover px-3 py-2.5 align-bottom`}>
                  Cliente
                </ThOrdenavel>
                <ThOrdenavel chave="valorVenda" ordem={ordem} onOrdenar={ordenar} rowSpan={2} className="px-3 py-2.5 align-bottom">
                  Valor Venda
                </ThOrdenavel>
                <ThOrdenavel chave="realizado" ordem={ordem} onOrdenar={ordenar} rowSpan={2} className="px-3 py-2.5 align-bottom">
                  Realizado
                </ThOrdenavel>
                <ThOrdenavel chave="saldo" ordem={ordem} onOrdenar={ordenar} rowSpan={2} className="px-3 py-2.5 align-bottom">
                  Saldo
                </ThOrdenavel>
                {TIPOS_COLUNA.map((t) => (
                  <ThOrdenavel key={t} chave={t} ordem={ordem} onOrdenar={ordenar} rowSpan={2} alinhar="direita" className="px-2 py-2.5 text-right align-bottom">
                    {TIPO_ITEM_CONFIG[t].label}
                    {sufixo}
                  </ThOrdenavel>
                ))}
                {grupos.map((g) => (
                  <th
                    key={g.ano}
                    colSpan={g.quantidade}
                    className="border-l-2 border-brand-border bg-[#e8efff] px-2 py-1 text-center text-[11px] tracking-[.12em] text-[#2456b8]"
                  >
                    {g.ano}
                  </th>
                ))}
                <ThOrdenavel
                  chave="totalPrevisto"
                  ordem={ordem}
                  onOrdenar={ordenar}
                  rowSpan={2}
                  alinhar="direita"
                  className="border-l-2 border-brand-border px-3 py-2.5 text-right align-bottom"
                >
                  Total Previsto{sufixo}
                </ThOrdenavel>
              </tr>
              <tr className="bg-brand-hover text-[10px] font-bold tracking-[.07em] whitespace-nowrap text-brand-faint uppercase">
                {meses.map((m, i) => (
                  <th
                    key={m}
                    title={`Previsto ${rotuloMesAno(m)}`}
                    className={`px-2 py-1.5 text-right ${inicioDeAno(i) ? "border-l-2 border-brand-border" : ""}`}
                  >
                    {rotuloMes(m)}/{m.slice(2, 4)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrizOrdenada.map((l) => (
                <tr key={l.clienteId} className="group border-t border-brand-border-soft whitespace-nowrap">
                  <td className={`${colCliente} bg-white px-3 py-2 font-bold text-brand-navy-2 group-hover:bg-brand-hover`}>{l.cliente}</td>
                  <td className="px-3 py-2 text-brand-muted">{moeda(l.valorVenda)}</td>
                  <td className="px-3 py-2 text-brand-muted">{moeda(l.realizado)}</td>
                  <td className="px-3 py-2 text-brand-muted">{moeda(l.saldo)}</td>
                  {TIPOS_COLUNA.map((t) => (
                    <td key={t} className="px-2 py-2 text-right text-brand-muted">
                      {l.porTipo[t] > 0 ? moeda(l.porTipo[t]) : "—"}
                    </td>
                  ))}
                  {l.previstoPorMes.map((v, i) => (
                    <td
                      key={meses[i]}
                      title={`${l.cliente} · ${rotuloMesAno(meses[i])}`}
                      className={`px-2 py-2 text-right ${v > 0 ? "text-brand-navy-2" : "text-brand-faint"} ${inicioDeAno(i) ? "border-l-2 border-brand-border" : ""}`}
                    >
                      {v > 0 ? moeda(v) : "—"}
                    </td>
                  ))}
                  <td className="border-l-2 border-brand-border px-3 py-2 text-right font-bold text-brand-navy-2">{moeda(l.totalPrevisto)}</td>
                </tr>
              ))}
              {matriz.length === 0 && (
                <tr>
                  <td colSpan={9 + meses.length} className="px-4 py-8 text-center text-brand-faint">
                    Nenhum lançamento previsto para esse filtro{ano === "todos" ? "" : ` em ${ano}`}.
                  </td>
                </tr>
              )}
            </tbody>
            {matriz.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-brand-border bg-brand-hover font-bold whitespace-nowrap text-brand-navy-2">
                  <td className={`${colCliente} bg-brand-hover px-3 py-2`}>Total</td>
                  <td className="px-3 py-2">{moeda(totaisTabela.valorVenda)}</td>
                  <td className="px-3 py-2">{moeda(totaisTabela.realizado)}</td>
                  <td className="px-3 py-2">{moeda(totaisTabela.saldo)}</td>
                  {TIPOS_COLUNA.map((t) => (
                    <td key={t} className="px-2 py-2 text-right">
                      {moeda(totaisTabela.porTipo[t])}
                    </td>
                  ))}
                  {totaisTabela.porMes.map((v, i) => (
                    <td key={meses[i]} className={`px-2 py-2 text-right ${inicioDeAno(i) ? "border-l-2 border-brand-border" : ""}`}>
                      {v > 0 ? moeda(v) : "—"}
                    </td>
                  ))}
                  <td className="border-l-2 border-brand-border px-3 py-2 text-right">{moeda(totaisTabela.totalPrevisto)}</td>
                </tr>
              </tfoot>
            )}
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
