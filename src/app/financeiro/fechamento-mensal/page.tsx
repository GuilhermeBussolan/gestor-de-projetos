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
  descreverEscopo,
  exportarFechamentoExcel,
  exportarFechamentoPdf,
  montarFechamentoMensal,
  parceirasComRecursos,
  recursosDoFiltro,
  temDesconto,
} from "@/lib/relatorioFechamento";
import type { Cliente, EmpresaParceira, EventoCalendario, Projeto, Recurso, TipoBox } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

function FechamentoMensalPageContent() {
  const { data: eventos } = useCollection<EventoCalendario>("eventosCalendario", []);
  const { data: recursos } = useCollection<Recurso>("recursos");
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const { data: parceiras } = useCollection<EmpresaParceira>("parceiras");

  const [mesAno, setMesAno] = useState(() => format(new Date(), "yyyy-MM"));
  const [tipo, setTipo] = useState<"" | TipoBox>("");
  const [parceiraId, setParceiraId] = useState("");
  const [recursoId, setRecursoId] = useState("");
  const [logoUrl, setLogoUrl] = useState("/logo-navy.png");
  const [exportando, setExportando] = useState<"pdf" | "excel" | null>(null);
  const [erroExportar, setErroExportar] = useState("");

  // O filtro de parceira só oferece quem tem recurso terceiro; próprios não têm parceira.
  const parceirasDoFiltro = useMemo(() => parceirasComRecursos(parceiras, recursos), [parceiras, recursos]);
  // O filtro de recurso oferece só quem passa nos filtros de tipo e parceiro.
  const recursosDoFiltroLista = useMemo(() => recursosDoFiltro(recursos, { tipo, parceiraId }), [recursos, tipo, parceiraId]);
  const recurso = recursoId ? (recursosDoFiltroLista.find((r) => r.id === recursoId) ?? null) : null;
  const filtros = useMemo(() => ({ tipo, parceiraId, recursoId: recurso ? recurso.id : "" }), [tipo, parceiraId, recurso]);
  const parceira = parceiraId ? (parceiras.find((p) => p.id === parceiraId) ?? null) : null;
  const parceiraDoRecurso = recurso?.parceiraId ? (parceiras.find((p) => p.id === recurso.parceiraId) ?? null) : null;
  const escopoBase = useMemo(
    () => descreverEscopo(filtros, recurso ? parceiraDoRecurso : parceira, recurso),
    [filtros, parceira, parceiraDoRecurso, recurso]
  );

  const linhas = useMemo(
    () => montarFechamentoMensal(eventos, recursos, projetos, clientes, parceiras, filtros, mesAno),
    [eventos, recursos, projetos, clientes, parceiras, filtros, mesAno]
  );
  // A coluna Desconto só aparece quando algum lançamento do período tem desconto.
  const escopo = useMemo(() => ({ ...escopoBase, incluirDesconto: temDesconto(linhas) }), [escopoBase, linhas]);

  const totalHoras = linhas.reduce((acc, l) => acc + l.totalHoras, 0);
  const totalRepasse = linhas.reduce((acc, l) => acc + l.valorRepasse, 0);
  const vencimento = mesAno ? calcularVencimentoFechamento(mesAno) : null;
  const colunas = 8 + (escopo.incluirVinculo ? 1 : 0) + (escopo.incluirDesconto ? 1 : 0);
  const sobrepostos = linhas.filter((l) => l.sobreposto).length;

  function alterarTipo(novo: "" | TipoBox) {
    setTipo(novo);
    setRecursoId("");
    if (novo === "proprio") setParceiraId("");
  }

  function alterarParceira(novo: string) {
    setParceiraId(novo);
    setRecursoId("");
  }

  async function exportar(formato: "pdf" | "excel") {
    setErroExportar("");
    setExportando(formato);
    try {
      if (formato === "pdf") await exportarFechamentoPdf(linhas, escopo, mesAno, logoUrl);
      else await exportarFechamentoExcel(linhas, escopo, mesAno, logoUrl);
    } catch (err) {
      console.error("Erro ao exportar o fechamento:", err);
      setErroExportar("Não foi possível gerar o arquivo. Tente de novo.");
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
        <div className="w-40 shrink-0">
          <FormRow label="Tipo de recurso">
            <Select value={tipo} onChange={(e) => alterarTipo(e.target.value as "" | TipoBox)}>
              <option value="">Todos</option>
              <option value="proprio">Próprios</option>
              <option value="terceiro">Terceiros</option>
            </Select>
          </FormRow>
        </div>
        <div className="w-64 shrink-0">
          <FormRow label="Parceiro">
            <Select
              value={parceiraId}
              onChange={(e) => alterarParceira(e.target.value)}
              disabled={tipo === "proprio"}
            >
              {tipo === "proprio" ? (
                <option value="">Não se aplica (recursos próprios)</option>
              ) : (
                <>
                  <option value="">Todos</option>
                  {parceirasDoFiltro.map((p) => (
                    <option key={p.id} value={p.id}>
                      {nomeExibicaoParceira(p)}
                    </option>
                  ))}
                </>
              )}
            </Select>
          </FormRow>
        </div>
        <div className="w-64 shrink-0">
          <FormRow label="Recurso (consultor)">
            <Select value={recurso ? recurso.id : ""} onChange={(e) => setRecursoId(e.target.value)}>
              <option value="">Todos</option>
              {recursosDoFiltroLista.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nomeCompleto}
                </option>
              ))}
            </Select>
          </FormRow>
        </div>
        <FormRow label="Logo (URL, opcional)">
          <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="w-64" />
        </FormRow>
        <Button
          variant="secondary"
          disabled={linhas.length === 0 || !!exportando}
          onClick={() => exportar("pdf")}
        >
          {exportando === "pdf" ? "Gerando..." : "Exportar PDF"}
        </Button>
        <Button
          variant="secondary"
          disabled={linhas.length === 0 || !!exportando}
          onClick={() => exportar("excel")}
        >
          {exportando === "excel" ? "Gerando..." : "Exportar Excel"}
        </Button>
      </div>
      {erroExportar && <p className="mb-3 text-sm font-medium text-red-600">{erroExportar}</p>}

      <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
          <div className="border-b border-brand-border-soft p-5">
            <p className="text-[15px] font-extrabold tracking-[-0.01em] text-brand-navy-2">
              Relatório de Fechamento Mensal
            </p>
            <p className="mt-1 text-[12.5px] text-brand-muted">
              Recursos: <strong className="text-brand-navy-2">{escopo.rotulo}</strong>
              {escopo.cnpj ? ` — CNPJ: ${escopo.cnpj}` : ""}
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

          {sobrepostos > 0 && (
            <p className="border-b border-brand-border-soft bg-[#fff2de] px-5 py-2.5 text-[12.5px] font-medium text-[#a4650d]">
              ⚠ {sobrepostos} lançamento{sobrepostos === 1 ? "" : "s"} com horário sobreposto (mesmo recurso, mesmo
              dia). Estão destacados abaixo para conferência.
            </p>
          )}

          <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="bg-brand-hover text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
                <th className="px-[18px] py-3.5">Data</th>
                <th className="px-[18px] py-3.5">Nome do recurso</th>
                {escopo.incluirVinculo && <th className="px-[18px] py-3.5">Vínculo</th>}
                <th className="px-[18px] py-3.5">Cliente</th>
                <th className="px-[18px] py-3.5">Projeto</th>
                <th className="px-[18px] py-3.5">Hora início</th>
                <th className="px-[18px] py-3.5">Hora fim</th>
                {escopo.incluirDesconto && <th className="px-[18px] py-3.5">Desconto</th>}
                <th className="px-[18px] py-3.5">Total de horas</th>
                <th className="px-[18px] py-3.5">Valor de repasse</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr
                  key={i}
                  className={`border-t border-brand-border-soft ${l.sobreposto ? "bg-[#fff8eb]" : ""}`}
                >
                  <td className="px-[18px] py-[13px] text-brand-muted">{dataBR(l.data)}</td>
                  <td className="px-[18px] py-[13px] font-bold text-brand-navy-2">{l.recursoNome}</td>
                  {escopo.incluirVinculo && <td className="px-[18px] py-[13px] text-brand-muted">{l.vinculo}</td>}
                  <td className="px-[18px] py-[13px] text-brand-muted">{l.cliente}</td>
                  <td className="px-[18px] py-[13px] text-brand-muted">{l.projeto}</td>
                  <td className="px-[18px] py-[13px] font-semibold whitespace-nowrap text-brand-navy-2">
                    {l.horaInicio || "—"}
                    {l.sobreposto && (
                      <span className="ml-2 rounded-full bg-[#fff2de] px-1.5 py-0.5 text-[9.5px] font-bold text-[#a4650d]">
                        sobreposto
                      </span>
                    )}
                  </td>
                  <td className="px-[18px] py-[13px] font-semibold whitespace-nowrap text-brand-navy-2">
                    {l.horaFim || "—"}
                  </td>
                  {escopo.incluirDesconto && (
                    <td className="px-[18px] py-[13px] text-brand-muted">
                      {l.horaDesconto && l.horaDesconto !== "00:00" ? l.horaDesconto : "—"}
                    </td>
                  )}
                  <td className="px-[18px] py-[13px] text-brand-navy-2">{formatarHoras(l.totalHoras)}</td>
                  <td className="px-[18px] py-[13px] font-bold text-brand-navy-2">{moeda(l.valorRepasse)}</td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={colunas} className="px-4 py-8 text-center text-brand-faint">
                    Nenhuma hora aprovada para esses filtros no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
            {linhas.length > 0 && (
              <tfoot>
                <tr className="border-t border-brand-border bg-brand-hover font-bold text-brand-navy-2">
                  <td className="px-[18px] py-3.5" colSpan={colunas - 2}>
                    Total
                  </td>
                  <td className="px-[18px] py-3.5">{formatarHoras(totalHoras)}</td>
                  <td className="px-[18px] py-3.5">{moeda(totalRepasse)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          </div>
      </div>
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
