"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { FinanceiroTabs } from "@/components/layout/FinanceiroTabs";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { calcularVencimentoFechamento } from "@/lib/feriados";
import { formatarHoras } from "@/lib/horas";
import { nomeExibicaoParceira } from "@/lib/parceira";
import {
  NG_INFORMATICA,
  OBSERVACAO_FECHAMENTO,
  exportarFechamentoExcel,
  exportarFechamentoPdf,
  montarFechamentoMensal,
} from "@/lib/relatorioFechamento";
import type { Cliente, EmpresaParceira, EventoCalendario, Projeto, Recurso } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

function FechamentoMensalPageContent() {
  const { data: eventos } = useCollection<EventoCalendario>("eventosCalendario", []);
  const { data: recursos } = useCollection<Recurso>("recursos");
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const { data: parceiras } = useCollection<EmpresaParceira>("parceiras");

  const [mesAno, setMesAno] = useState(() => format(new Date(), "yyyy-MM"));
  const [parceiraId, setParceiraId] = useState("");
  const [logoUrl, setLogoUrl] = useState("/logo-navy.png");
  const [exportando, setExportando] = useState<"pdf" | "excel" | null>(null);

  const parceira = parceiras.find((p) => p.id === parceiraId) ?? null;

  const linhas = useMemo(() => {
    if (!parceiraId) return [];
    return montarFechamentoMensal(eventos, recursos, projetos, clientes, parceiraId, mesAno);
  }, [eventos, recursos, projetos, clientes, parceiraId, mesAno]);

  const totalHoras = linhas.reduce((acc, l) => acc + l.totalHoras, 0);
  const totalRepasse = linhas.reduce((acc, l) => acc + l.valorRepasse, 0);
  const vencimento = mesAno ? calcularVencimentoFechamento(mesAno) : null;

  async function exportarPdf() {
    if (!parceira) return;
    setExportando("pdf");
    try {
      await exportarFechamentoPdf(linhas, parceira, mesAno, logoUrl);
    } finally {
      setExportando(null);
    }
  }

  async function exportarExcel() {
    if (!parceira) return;
    setExportando("excel");
    try {
      await exportarFechamentoExcel(linhas, parceira, mesAno, logoUrl);
    } finally {
      setExportando(null);
    }
  }

  return (
    <div>
      <FinanceiroTabs />
      <h1 className="mb-5 text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">
        Fechamento Mensal
      </h1>

      <div className="mb-5 flex flex-wrap items-end gap-2.5">
        <FormRow label="Mês/ano">
          <Input type="month" value={mesAno} onChange={(e) => setMesAno(e.target.value)} className="w-40" />
        </FormRow>
        <FormRow label="Parceiro">
          <Select value={parceiraId} onChange={(e) => setParceiraId(e.target.value)} className="w-64">
            <option value="">Selecione...</option>
            {parceiras.map((p) => (
              <option key={p.id} value={p.id}>
                {nomeExibicaoParceira(p)}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Logo (URL, opcional)">
          <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="w-64" />
        </FormRow>
        <Button
          variant="secondary"
          disabled={!parceira || linhas.length === 0 || !!exportando}
          onClick={exportarPdf}
        >
          {exportando === "pdf" ? "Gerando..." : "Exportar PDF"}
        </Button>
        <Button
          variant="secondary"
          disabled={!parceira || linhas.length === 0 || !!exportando}
          onClick={exportarExcel}
        >
          {exportando === "excel" ? "Gerando..." : "Exportar Excel"}
        </Button>
      </div>

      {!parceiraId && (
        <p className="rounded-2xl border border-dashed border-brand-border bg-white p-8 text-center text-brand-faint">
          Selecione um parceiro e o mês/ano para gerar o fechamento.
        </p>
      )}

      {parceiraId && (
        <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
          <div className="border-b border-brand-border-soft p-5">
            <p className="text-[15px] font-extrabold tracking-[-0.01em] text-brand-navy-2">
              Relatório de Fechamento Mensal
            </p>
            <p className="mt-1 text-[12.5px] text-brand-muted">
              Parceiro: <strong className="text-brand-navy-2">{nomeExibicaoParceira(parceira ?? undefined)}</strong>
              {parceira ? ` — CNPJ: ${parceira.cnpj}` : ""}
            </p>
            <p className="text-[12.5px] text-brand-muted">
              {NG_INFORMATICA.razaoSocial} — CNPJ: {NG_INFORMATICA.cnpj}
            </p>
            <p className="text-[12.5px] text-brand-muted">
              Vencimento:{" "}
              <strong className="text-brand-navy-2">{vencimento ? format(vencimento, "dd/MM/yyyy") : "—"}</strong>
            </p>
            <p className="mt-2 text-[11.5px] text-brand-faint italic">{OBSERVACAO_FECHAMENTO}</p>
          </div>

          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="bg-brand-hover text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
                <th className="px-[18px] py-3.5">Data</th>
                <th className="px-[18px] py-3.5">Nome do recurso</th>
                <th className="px-[18px] py-3.5">Cliente</th>
                <th className="px-[18px] py-3.5">Projeto</th>
                <th className="px-[18px] py-3.5">Total de horas</th>
                <th className="px-[18px] py-3.5">Valor de repasse</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} className="border-t border-brand-border-soft">
                  <td className="px-[18px] py-[13px] text-brand-muted">{dataBR(l.data)}</td>
                  <td className="px-[18px] py-[13px] font-bold text-brand-navy-2">{l.recursoNome}</td>
                  <td className="px-[18px] py-[13px] text-brand-muted">{l.cliente}</td>
                  <td className="px-[18px] py-[13px] text-brand-muted">{l.projeto}</td>
                  <td className="px-[18px] py-[13px] text-brand-navy-2">{formatarHoras(l.totalHoras)}</td>
                  <td className="px-[18px] py-[13px] font-bold text-brand-navy-2">{moeda(l.valorRepasse)}</td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-brand-faint">
                    Nenhuma hora aprovada desse parceiro no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
            {linhas.length > 0 && (
              <tfoot>
                <tr className="border-t border-brand-border bg-brand-hover font-bold text-brand-navy-2">
                  <td className="px-[18px] py-3.5" colSpan={4}>
                    Total
                  </td>
                  <td className="px-[18px] py-3.5">{formatarHoras(totalHoras)}</td>
                  <td className="px-[18px] py-3.5">{moeda(totalRepasse)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

export default function FechamentoMensalPage() {
  return (
    <ProtectedPage perfis={["administrador", "financeiro"]}>
      <FechamentoMensalPageContent />
    </ProtectedPage>
  );
}
