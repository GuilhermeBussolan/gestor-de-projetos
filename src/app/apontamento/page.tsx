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
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Seu usuário ainda não está vinculado a um recurso. Peça a um administrador para vincular
        seu usuário a um recurso em Cadastros → Usuários.
      </p>
    );
  }

  async function excluir(ev: EventoCalendario) {
    if (!confirm("Excluir este lançamento? Ele some do seu calendário também.")) return;
    await deleteDoc(doc(db, "eventosCalendario", ev.id));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Minhas horas</h2>
        <Link href="/calendario">
          <Button>+ Lançar no calendário</Button>
        </Link>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        As horas aqui vêm direto do que você lança no seu Calendário — não precisa digitar de novo.
      </p>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Projeto</th>
              <th className="px-4 py-3">Início</th>
              <th className="px-4 py-3">Fim</th>
              <th className="px-4 py-3">Desconto</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {minhasHoras.map((ev) => {
              const projeto = projetos.find((p) => p.id === ev.projetoId);
              const cliente = clientes.find((c) => c.id === projeto?.clienteId);
              return (
                <tr key={ev.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{ev.data.split("-").reverse().join("/")}</td>
                  <td className="px-4 py-3">{nomeExibicaoCliente(cliente)}</td>
                  <td className="px-4 py-3">{ev.horaInicio}</td>
                  <td className="px-4 py-3">{ev.horaFim}</td>
                  <td className="px-4 py-3">{ev.horaDesconto}</td>
                  <td className="px-4 py-3 font-medium">{formatarHoras(ev.totalHoras)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => excluir(ev)} className="text-red-600 hover:underline">
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
            {minhasHoras.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma hora lançada ainda. Lance direto no seu Calendário.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
    <div className="mt-10 border-t border-slate-200 pt-8">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Relatório analítico por recurso
      </h2>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <FormRow label="Filtrar por recurso">
          <Select value={recursoFiltro} onChange={(e) => setRecursoFiltro(e.target.value)}>
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

      <div className="space-y-6">
        {relatorio.map((r) => (
          <div key={r.recurso.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">
              {r.recurso.nomeCompleto} ({r.recurso.codigo})
            </p>
            <p className="mb-3 text-sm text-slate-500">
              Total: {formatarHoras(r.totalHoras)} · Valor/hora:{" "}
              {r.recurso.valorHora.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ·
              Valor a repassar:{" "}
              <strong>
                {r.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong>
            </p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase text-slate-400">
                <tr>
                  <th className="py-1">Data</th>
                  <th className="py-1">Projeto</th>
                  <th className="py-1">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {r.linhas.map((l, i) => (
                  <tr key={i}>
                    <td className="py-1">{l.data.split("-").reverse().join("/")}</td>
                    <td className="py-1">{l.projeto}</td>
                    <td className="py-1">{formatarHoras(l.totalHoras)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {relatorio.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-400">
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
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Apontamento de horas</h1>
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
