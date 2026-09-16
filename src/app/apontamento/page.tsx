"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { deleteDoc, doc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { FormRow, Select } from "@/components/ui/Field";
import { useAuth } from "@/contexts/AuthContext";
import { formatarHoras } from "@/lib/horas";
import { nomeExibicaoCliente } from "@/lib/cliente";
import {
  montarRelatorio,
  exportarRelatorioWord,
  exportarRelatorioPdf,
} from "@/lib/relatorioApontamento";
import type { Cliente, EventoCalendario, Projeto, Recurso } from "@/types";

function MinhasHoras() {
  const { usuario } = useAuth();
  const recursoId = usuario?.recursoId ?? null;
  const { data: eventos } = useCollection<EventoCalendario>(
    "eventosCalendario",
    [where("recursoId", "==", recursoId ?? "")],
    !!recursoId
  );
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");

  const minhasHoras = useMemo(
    () => [...eventos].sort((a, b) => (a.data === b.data ? a.horaInicio.localeCompare(b.horaInicio) : a.data < b.data ? 1 : -1)),
    [eventos]
  );

  if (!recursoId) {
    return (
      <p className="rounded-lg border border-dashed border-brand-border bg-white p-6 text-sm text-brand-muted">
        Seu usuário ainda não está vinculado a um recurso. Peça a um administrador para vincular
        seu usuário a um recurso em Cadastros → Usuários.
      </p>
    );
  }

  async function excluir(ev: EventoCalendario) {
    if (!confirm("Excluir este lançamento? Ele some do seu calendário também.")) return;
    await deleteDoc(doc(db, "eventosCalendario", ev.id));
  }

  const contabilizadas = minhasHoras.filter((e) => !(e.origem === "recorrencia" && e.status !== "realizada"));
  const totalHoras = contabilizadas.reduce((acc, e) => acc + e.totalHoras, 0);
  const diasLancados = new Set(contabilizadas.map((e) => e.data)).size;
  const projetosAtendidos = new Set(contabilizadas.map((e) => e.projetoId)).size;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-extrabold tracking-[-0.01em] text-brand-navy-2">Minhas horas</h2>
        <Link href="/calendario">
          <Button>+ Lançar no calendário</Button>
        </Link>
      </div>
      <p className="mb-5 text-sm text-brand-muted">
        As horas aqui vêm direto do que você lança no seu Calendário — não precisa digitar de novo.
      </p>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-card">
          <p className="mb-1.5 text-[11px] font-bold tracking-[.1em] text-brand-faint uppercase">
            Total de horas
          </p>
          <p className="text-2xl font-extrabold tracking-[-0.02em] text-brand-navy-2">
            {formatarHoras(totalHoras)}
          </p>
        </div>
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-card">
          <p className="mb-1.5 text-[11px] font-bold tracking-[.1em] text-brand-faint uppercase">
            Dias com lançamento
          </p>
          <p className="text-2xl font-extrabold tracking-[-0.02em] text-brand-navy-2">{diasLancados}</p>
        </div>
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-card">
          <p className="mb-1.5 text-[11px] font-bold tracking-[.1em] text-brand-faint uppercase">
            Projetos atendidos
          </p>
          <p className="text-2xl font-extrabold tracking-[-0.02em] text-brand-navy-2">
            {projetosAtendidos}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead>
              <tr className="bg-brand-hover text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
                <th className="px-[18px] py-3.5">Data</th>
                <th className="px-[18px] py-3.5">Projeto</th>
                <th className="px-[18px] py-3.5">Início</th>
                <th className="px-[18px] py-3.5">Fim</th>
                <th className="px-[18px] py-3.5">Desconto</th>
                <th className="px-[18px] py-3.5">Origem</th>
                <th className="px-[18px] py-3.5 text-right">Total</th>
                <th className="px-[18px] py-3.5" />
              </tr>
            </thead>
            <tbody>
              {minhasHoras.map((ev) => {
                const projeto = projetos.find((p) => p.id === ev.projetoId);
                const cliente = clientes.find((c) => c.id === projeto?.clienteId);
                const avulso = ev.origem !== "recorrencia";
                return (
                  <tr key={ev.id} className="border-t border-brand-border-soft hover:bg-brand-hover">
                    <td className="px-[18px] py-[13px] text-brand-navy-2">
                      {ev.data.split("-").reverse().join("/")}
                    </td>
                    <td className="px-[18px] py-[13px] font-bold text-brand-navy-2">
                      {nomeExibicaoCliente(cliente)}
                    </td>
                    <td className="px-[18px] py-[13px] text-brand-muted">{ev.horaInicio}</td>
                    <td className="px-[18px] py-[13px] text-brand-muted">{ev.horaFim}</td>
                    <td className="px-[18px] py-[13px] text-brand-faint">{ev.horaDesconto}</td>
                    <td className="px-[18px] py-[13px]">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                          avulso
                            ? "bg-brand-accent-soft text-[#2456b8]"
                            : "bg-[#fff2de] text-[#a4650d]"
                        }`}
                      >
                        {avulso ? "Avulso" : "Recorrência"}
                      </span>
                    </td>
                    <td className="px-[18px] py-[13px] text-right font-bold text-brand-navy-2">
                      {formatarHoras(ev.totalHoras)}
                    </td>
                    <td className="px-[18px] py-[13px] text-right">
                      <button onClick={() => excluir(ev)} className="text-red-600 hover:underline">
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
              {minhasHoras.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-brand-faint">
                    Nenhuma hora lançada ainda. Lance direto no seu Calendário.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RelatorioAnalitico() {
  const { data: eventos } = useCollection<EventoCalendario>("eventosCalendario", []);
  const { data: recursos } = useCollection<Recurso>("recursos");
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const [recursoFiltro, setRecursoFiltro] = useState("");

  const relatorio = useMemo(
    () => montarRelatorio(eventos, recursos, projetos, clientes, recursoFiltro || undefined),
    [eventos, recursos, projetos, clientes, recursoFiltro]
  );

  return (
    <div className="mt-11 border-t border-brand-border pt-8">
      <h2 className="mb-4 text-lg font-extrabold tracking-[-0.01em] text-brand-navy-2">
        Relatório analítico por recurso
      </h2>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <FormRow label="Filtrar por recurso">
          <Select value={recursoFiltro} onChange={(e) => setRecursoFiltro(e.target.value)} className="w-56">
            <option value="">Todos os recursos</option>
            {recursos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nomeCompleto}
              </option>
            ))}
          </Select>
        </FormRow>
        <Button
          variant="secondary"
          disabled={relatorio.length === 0}
          onClick={() => exportarRelatorioWord(relatorio)}
        >
          Exportar Word
        </Button>
        <Button
          variant="secondary"
          disabled={relatorio.length === 0}
          onClick={() => exportarRelatorioPdf(relatorio)}
        >
          Exportar PDF
        </Button>
      </div>

      <div className="space-y-4">
        {relatorio.map((r) => (
          <div key={r.recurso.id} className="rounded-2xl border border-brand-border bg-white p-5 shadow-card">
            <p className="text-[15px] font-extrabold tracking-[-0.01em] text-brand-navy-2">
              {r.recurso.nomeCompleto} ({r.recurso.codigo})
            </p>
            <p className="mb-3.5 text-sm text-brand-muted">
              Total: <strong className="text-brand-navy-2">{formatarHoras(r.totalHoras)}</strong> ·
              Valor/hora:{" "}
              {r.recurso.valorHora.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ·
              Valor a repassar:{" "}
              <strong className="text-brand-navy-2">
                {r.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong>
            </p>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-brand-border-soft text-left text-[11px] font-bold tracking-[.08em] text-brand-faint uppercase">
                  <th className="py-2">Data</th>
                  <th className="py-2">Projeto</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {r.linhas.map((l, i) => (
                  <tr key={i} className="border-b border-brand-border-soft last:border-b-0">
                    <td className="py-2 text-brand-muted">{l.data.split("-").reverse().join("/")}</td>
                    <td className="py-2 text-brand-navy-2">{l.projeto}</td>
                    <td className="py-2 text-right font-bold text-brand-navy-2">
                      {formatarHoras(l.totalHoras)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {relatorio.length === 0 && (
          <p className="rounded-2xl border border-dashed border-brand-border bg-white p-6 text-center text-brand-faint">
            Nenhum lançamento encontrado para o filtro selecionado.
          </p>
        )}
      </div>
    </div>
  );
}

function ApontamentoPageContent() {
  const { usuario } = useAuth();
  return (
    <div>
      <h1 className="mb-6 text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">
        Apontamento de horas
      </h1>
      <MinhasHoras />
      {usuario?.perfil === "administrador" && <RelatorioAnalitico />}
    </div>
  );
}

export default function ApontamentoPage() {
  return (
    <ProtectedPage perfis={["administrador", "coordenador", "consultor"]}>
      <ApontamentoPageContent />
    </ProtectedPage>
  );
}
