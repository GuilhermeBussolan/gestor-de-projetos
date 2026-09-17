"use client";

import { useMemo, useState } from "react";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { FinanceiroTabs } from "@/components/layout/FinanceiroTabs";
import { Button } from "@/components/ui/Button";
import { FormRow, Input } from "@/components/ui/Field";
import { AlterarStatusParcelaModal } from "@/components/financeiro/AlterarStatusParcelaModal";
import { STATUS_FATURAMENTO_ORDEM, STATUS_PARCELA_CONFIG, STATUS_PARCELA_ORDEM } from "@/lib/constants";
import { alterarStatusParcela, type DadosStatusParcela } from "@/lib/parcela";
import {
  montarRelatorioLiberacao,
  exportarLiberacaoExcel,
  exportarLiberacaoPdf,
} from "@/lib/relatorioLiberacao";
import type { Cliente, Projeto, StatusParcela } from "@/types";

const PRECISA_DADOS: StatusParcela[] = ["FATURADO", "RECEBIDO", "CANCELADO"];

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatarData(timestamp: number | null) {
  return timestamp ? new Date(timestamp).toLocaleDateString("pt-BR") : "—";
}

function StatusCard({
  label,
  valor,
  cor,
  ativo,
  onClick,
}: {
  label: string;
  valor: number;
  cor: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border bg-white p-4 text-left shadow-card transition-colors ${
        ativo ? "border-brand-accent ring-2 ring-brand-accent/20" : "border-brand-border hover:border-brand-accent/40"
      }`}
    >
      <p
        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-[.09em] uppercase"
        style={{ color: cor }}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cor }} />
        {label}
      </p>
      <p className="text-xl font-extrabold tracking-[-0.02em] text-brand-navy-2">{moeda(valor)}</p>
    </button>
  );
}

function FinanceiroLiberacaoPageContent() {
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");

  const [filtroMes, setFiltroMes] = useState("");
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusParcela | null>(null);
  const [alterando, setAlterando] = useState<{
    projeto: Projeto;
    numero: number;
    status: StatusParcela;
  } | null>(null);

  const todasLiberacoes = useMemo(() => montarRelatorioLiberacao(projetos, clientes), [projetos, clientes]);

  const noPeriodo = useMemo(() => {
    return todasLiberacoes.filter((l) => {
      if (filtroMes) {
        const mes = l.dataLiberacao ? new Date(l.dataLiberacao).toISOString().slice(0, 7) : "";
        if (mes !== filtroMes) return false;
      }
      if (filtroDe || filtroAte) {
        const dataISO = l.dataLiberacao ? new Date(l.dataLiberacao).toISOString().slice(0, 10) : "";
        if (filtroDe && dataISO < filtroDe) return false;
        if (filtroAte && dataISO > filtroAte) return false;
      }
      return true;
    });
  }, [todasLiberacoes, filtroMes, filtroDe, filtroAte]);

  const totaisPorStatus = useMemo(() => {
    const totais: Record<StatusParcela, number> = {
      AGUARDANDO: 0,
      LIBERADO: 0,
      FATURADO: 0,
      RECEBIDO: 0,
      CANCELADO: 0,
    };
    noPeriodo.forEach((l) => {
      totais[l.status] += l.valor;
    });
    return totais;
  }, [noPeriodo]);

  const totalRecebido = totaisPorStatus.RECEBIDO;
  const totalAReceber = totaisPorStatus.LIBERADO + totaisPorStatus.FATURADO;

  const liberacoesExibidas = filtroStatus ? noPeriodo.filter((l) => l.status === filtroStatus) : noPeriodo;

  function limparFiltros() {
    setFiltroMes("");
    setFiltroDe("");
    setFiltroAte("");
  }

  function alterarStatus(l: (typeof liberacoesExibidas)[number], status: StatusParcela) {
    const projeto = projetos.find((p) => p.id === l.projetoId);
    if (!projeto) return;
    if (PRECISA_DADOS.includes(status)) {
      setAlterando({ projeto, numero: l.numero, status });
    } else {
      alterarStatusParcela(projeto, l.numero, status);
    }
  }

  async function confirmarAlteracao(dados: DadosStatusParcela) {
    if (!alterando) return;
    await alterarStatusParcela(alterando.projeto, alterando.numero, alterando.status, dados);
    setAlterando(null);
  }

  return (
    <div>
      <FinanceiroTabs />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">
          Liberação de Faturamento
        </h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={liberacoesExibidas.length === 0}
            onClick={() => exportarLiberacaoPdf(liberacoesExibidas)}
          >
            Exportar PDF
          </Button>
          <Button
            variant="secondary"
            disabled={liberacoesExibidas.length === 0}
            onClick={() => exportarLiberacaoExcel(liberacoesExibidas)}
          >
            Exportar Excel
          </Button>
        </div>
      </div>

      <p className="mb-5 text-sm text-brand-muted">
        Parcelas liberadas, faturadas, recebidas ou canceladas — acompanhe o status de faturamento de
        cada uma e filtre por período.
      </p>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-card">
          <p className="mb-1.5 text-[11px] font-bold tracking-[.1em] text-[#15754c] uppercase opacity-75">
            Recebido
          </p>
          <p className="text-2xl font-extrabold tracking-[-0.02em] text-[#15754c]">{moeda(totalRecebido)}</p>
        </div>
        <div className="rounded-2xl bg-brand-navy p-4 text-white shadow-navy">
          <p className="mb-1.5 text-[11px] font-bold tracking-[.1em] text-white/75 uppercase">A receber</p>
          <p className="text-2xl font-extrabold tracking-[-0.02em]">{moeda(totalAReceber)}</p>
          <p className="mt-1 text-[11px] text-white/60">liberado + faturado</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_FATURAMENTO_ORDEM.map((s) => (
          <StatusCard
            key={s}
            label={STATUS_PARCELA_CONFIG[s].label}
            valor={totaisPorStatus[s]}
            cor={STATUS_PARCELA_CONFIG[s].text}
            ativo={filtroStatus === s}
            onClick={() => setFiltroStatus((v) => (v === s ? null : s))}
          />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <FormRow label="Mês de liberação">
          <Input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-40" />
        </FormRow>
        <FormRow label="Liberado de">
          <Input type="date" value={filtroDe} onChange={(e) => setFiltroDe(e.target.value)} className="w-40" />
        </FormRow>
        <FormRow label="até">
          <Input type="date" value={filtroAte} onChange={(e) => setFiltroAte(e.target.value)} className="w-40" />
        </FormRow>
        {(filtroMes || filtroDe || filtroAte) && (
          <button
            type="button"
            onClick={limparFiltros}
            className="mb-2.5 text-[12.5px] font-semibold text-brand-accent hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13px]">
            <thead>
              <tr className="bg-brand-hover text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Parcela</th>
                <th className="px-4 py-3">Valor a faturar</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">CNPJ</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">E-mail para NF</th>
                <th className="px-4 py-3">Liberado em</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {liberacoesExibidas.map((l) => (
                <tr key={`${l.projetoId}-${l.numero}`} className="border-t border-brand-border-soft">
                  <td className="px-4 py-3 font-bold text-brand-navy-2">{l.cliente}</td>
                  <td className="px-4 py-3 text-brand-muted">{l.parcela}</td>
                  <td className="px-4 py-3 font-semibold text-brand-navy-2">{moeda(l.valor)}</td>
                  <td className="px-4 py-3 text-brand-muted">{l.contato || "—"}</td>
                  <td className="px-4 py-3 text-brand-muted">{l.cnpj || "—"}</td>
                  <td className="px-4 py-3 text-brand-muted">{l.email || "—"}</td>
                  <td className="px-4 py-3 text-brand-muted">{l.emailNF || "—"}</td>
                  <td className="px-4 py-3 text-brand-muted">{formatarData(l.dataLiberacao)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={l.status}
                      onChange={(e) => alterarStatus(l, e.target.value as StatusParcela)}
                      style={{
                        backgroundColor: STATUS_PARCELA_CONFIG[l.status].bg,
                        color: STATUS_PARCELA_CONFIG[l.status].text,
                      }}
                      className="rounded-full border-0 px-2.5 py-1 text-[10.5px] font-bold"
                    >
                      {STATUS_PARCELA_ORDEM.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_PARCELA_CONFIG[s].label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {liberacoesExibidas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-brand-faint">
                    {todasLiberacoes.length === 0
                      ? "Nenhuma parcela liberada para faturamento ainda."
                      : "Nenhuma parcela encontrada para esse filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlterarStatusParcelaModal
        statusAlvo={alterando?.status ?? null}
        onCancelar={() => setAlterando(null)}
        onConfirmar={confirmarAlteracao}
      />
    </div>
  );
}

export default function FinanceiroLiberacaoPage() {
  return (
    <ProtectedPage perfis={["administrador", "financeiro"]}>
      <FinanceiroLiberacaoPageContent />
    </ProtectedPage>
  );
}
