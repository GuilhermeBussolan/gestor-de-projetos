"use client";

import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { useAuth } from "@/contexts/AuthContext";
import { calcularTotalHoras, formatarHoras } from "@/lib/horas";
import { nomeExibicaoCliente } from "@/lib/cliente";
import {
  montarRelatorio,
  exportarRelatorioWord,
  exportarRelatorioPdf,
} from "@/lib/relatorioApontamento";
import type { Apontamento, Cliente, EventoCalendario, Projeto, Recurso } from "@/types";

function MeusApontamentos() {
  const { usuario } = useAuth();
  const recursoId = usuario?.recursoId ?? null;
  const { data: apontamentos } = useCollection<Apontamento>(
    "apontamentos",
    [where("recursoId", "==", recursoId ?? "")],
    !!recursoId
  );
  const { data: eventos } = useCollection<EventoCalendario>("eventosCalendario", []);
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");

  const [modalAberto, setModalAberto] = useState(false);
  const [projetoId, setProjetoId] = useState("");
  const [data, setData] = useState("");
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFim, setHoraFim] = useState("17:00");
  const [horaDesconto, setHoraDesconto] = useState("01:00");
  const [salvando, setSalvando] = useState(false);

  const meusApontamentos = useMemo(
    () => [...apontamentos].sort((a, b) => (a.data < b.data ? 1 : -1)),
    [apontamentos]
  );

  const projetosDisponiveis = useMemo(() => {
    const idsDoCalendario = new Set(
      eventos.filter((e) => e.recursoId === recursoId).map((e) => e.projetoId)
    );
    return projetos.filter((p) => idsDoCalendario.has(p.id));
  }, [eventos, projetos, recursoId]);

  if (!recursoId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Seu usuário ainda não está vinculado a um recurso. Peça a um administrador para vincular
        seu usuário a um recurso em Cadastros → Usuários.
      </p>
    );
  }

  function abrirNovo() {
    setProjetoId("");
    setData("");
    setHoraInicio("08:00");
    setHoraFim("17:00");
    setHoraDesconto("01:00");
    setModalAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!projetoId || !data || !recursoId) return;
    setSalvando(true);
    try {
      const totalHoras = calcularTotalHoras(horaInicio, horaFim, horaDesconto);
      await addDoc(collection(db, "apontamentos"), {
        recursoId,
        projetoId,
        data,
        horaInicio,
        horaFim,
        horaDesconto,
        totalHoras,
        createdAt: Date.now(),
      });
      setModalAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(a: Apontamento) {
    if (!confirm("Excluir este apontamento?")) return;
    await deleteDoc(doc(db, "apontamentos", a.id));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Meus apontamentos</h2>
        <Button onClick={abrirNovo}>+ Novo apontamento</Button>
      </div>

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
            {meusApontamentos.map((a) => {
              const projeto = projetos.find((p) => p.id === a.projetoId);
              const cliente = clientes.find((c) => c.id === projeto?.clienteId);
              return (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{a.data.split("-").reverse().join("/")}</td>
                  <td className="px-4 py-3">{nomeExibicaoCliente(cliente)}</td>
                  <td className="px-4 py-3">{a.horaInicio}</td>
                  <td className="px-4 py-3">{a.horaFim}</td>
                  <td className="px-4 py-3">{a.horaDesconto}</td>
                  <td className="px-4 py-3 font-medium">{formatarHoras(a.totalHoras)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => excluir(a)} className="text-red-600 hover:underline">
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
            {meusApontamentos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhum apontamento registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title="Novo apontamento">
        <form onSubmit={salvar} className="space-y-4">
          <FormRow label="Projeto">
            <Select value={projetoId} onChange={(e) => setProjetoId(e.target.value)} required>
              <option value="">Selecione...</option>
              {projetosDisponiveis.map((p) => {
                const cliente = clientes.find((c) => c.id === p.clienteId);
                return (
                  <option key={p.id} value={p.id}>
                    {nomeExibicaoCliente(cliente)} — {p.codigoProposta}
                  </option>
                );
              })}
            </Select>
            {projetosDisponiveis.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Você ainda não tem projetos previstos no seu calendário.
              </p>
            )}
          </FormRow>
          <FormRow label="Data">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </FormRow>
          <div className="grid grid-cols-3 gap-3">
            <FormRow label="Hora início">
              <Input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                required
              />
            </FormRow>
            <FormRow label="Hora fim">
              <Input
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                required
              />
            </FormRow>
            <FormRow label="Desconto">
              <Input
                type="time"
                value={horaDesconto}
                onChange={(e) => setHoraDesconto(e.target.value)}
              />
            </FormRow>
          </div>
          <p className="text-sm text-slate-500">
            Total: <strong>{formatarHoras(calcularTotalHoras(horaInicio, horaFim, horaDesconto))}</strong>
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function RelatorioAnalitico() {
  const { data: apontamentos } = useCollection<Apontamento>("apontamentos", []);
  const { data: recursos } = useCollection<Recurso>("recursos");
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const [recursoFiltro, setRecursoFiltro] = useState("");

  const relatorio = useMemo(
    () => montarRelatorio(apontamentos, recursos, projetos, clientes, recursoFiltro || undefined),
    [apontamentos, recursos, projetos, clientes, recursoFiltro]
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
            Nenhum apontamento encontrado para o filtro selecionado.
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
      <MeusApontamentos />
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
