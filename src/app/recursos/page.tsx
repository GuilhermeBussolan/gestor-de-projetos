"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { TIPO_RECURSO_CONFIG } from "@/lib/constants";
import type { Recurso, TipoRecurso } from "@/types";

const RECURSO_VAZIO = {
  tipo: "consultor_funcional" as TipoRecurso,
  nomeCompleto: "",
  codigo: "",
  valorHora: "",
};

function RecursosPageContent() {
  const { data: recursos, loading } = useCollection<Recurso>("recursos");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Recurso | null>(null);
  const [form, setForm] = useState(RECURSO_VAZIO);
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() {
    setEditando(null);
    setForm(RECURSO_VAZIO);
    setModalAberto(true);
  }

  function abrirEdicao(r: Recurso) {
    setEditando(r);
    setForm({
      tipo: r.tipo,
      nomeCompleto: r.nomeCompleto,
      codigo: r.codigo,
      valorHora: String(r.valorHora),
    });
    setModalAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const dados = { ...form, valorHora: Number(form.valorHora) || 0 };
      if (editando) {
        await updateDoc(doc(db, "recursos", editando.id), dados);
      } else {
        await addDoc(collection(db, "recursos"), { ...dados, createdAt: Date.now() });
      }
      setModalAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(r: Recurso) {
    if (!confirm(`Excluir o recurso "${r.nomeCompleto}"?`)) return;
    await deleteDoc(doc(db, "recursos", r.id));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Recursos</h1>
        <Button onClick={abrirNovo}>+ Novo recurso</Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Nome completo</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Valor/hora</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recursos.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{TIPO_RECURSO_CONFIG[r.tipo].label}</td>
                <td className="px-4 py-3">{r.nomeCompleto}</td>
                <td className="px-4 py-3">{r.codigo}</td>
                <td className="px-4 py-3">
                  {r.valorHora.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => abrirEdicao(r)}
                    className="mr-3 text-sky-600 hover:underline"
                  >
                    Editar
                  </button>
                  <button onClick={() => excluir(r)} className="text-red-600 hover:underline">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {!loading && recursos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Nenhum recurso cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? "Editar recurso" : "Novo recurso"}
      >
        <form onSubmit={salvar} className="space-y-4">
          <FormRow label="Categoria">
            <Select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoRecurso })}
            >
              {Object.entries(TIPO_RECURSO_CONFIG).map(([valor, cfg]) => (
                <option key={valor} value={valor}>
                  {cfg.label}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="Nome completo">
            <Input
              value={form.nomeCompleto}
              onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })}
              required
            />
          </FormRow>
          <FormRow label="Código">
            <Input
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              required
            />
          </FormRow>
          <FormRow label="Valor da hora (R$)">
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={form.valorHora}
              onChange={(e) => setForm({ ...form, valorHora: e.target.value })}
              required
            />
          </FormRow>
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

export default function RecursosPage() {
  return (
    <ProtectedPage perfis={["administrador"]}>
      <RecursosPageContent />
    </ProtectedPage>
  );
}
