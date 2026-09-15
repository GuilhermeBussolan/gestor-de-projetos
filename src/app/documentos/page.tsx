"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormRow, Input } from "@/components/ui/Field";
import type { TipoDocumento } from "@/types";

const VAZIO = { codigo: "", descricao: "", pesoIndividual: 0 };

function DocumentosPageContent() {
  const { data: tipos, loading } = useCollection<TipoDocumento>("tiposDocumento", []);
  const ordenados = [...tipos].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<TipoDocumento | null>(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const somaPesos = ordenados.reduce((acc, t) => acc + (t.pesoIndividual ?? 0), 0);

  function abrirNovo() {
    setEditando(null);
    setForm(VAZIO);
    setModalAberto(true);
  }

  function abrirEdicao(t: TipoDocumento) {
    setEditando(t);
    setForm({ codigo: t.codigo, descricao: t.descricao, pesoIndividual: t.pesoIndividual });
    setModalAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      if (editando) {
        await updateDoc(doc(db, "tiposDocumento", editando.id), { ...form });
      } else {
        await addDoc(collection(db, "tiposDocumento"), {
          ...form,
          ordem: ordenados.length,
        });
      }
      setModalAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(t: TipoDocumento) {
    if (!confirm(`Excluir o tipo de documento "${t.codigo} — ${t.descricao}"?`)) return;
    await deleteDoc(doc(db, "tiposDocumento", t.id));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Tipos de documento</h1>
          <p className="text-sm text-slate-500">
            Soma dos pesos individuais cadastrados: <strong>{somaPesos}</strong>
            {somaPesos !== 100 && (
              <span className="text-amber-600"> (o padrão de negócio soma 100)</span>
            )}
          </p>
        </div>
        <Button onClick={abrirNovo}>+ Novo tipo</Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Peso individual</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ordenados.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{t.codigo}</td>
                <td className="px-4 py-3">{t.descricao}</td>
                <td className="px-4 py-3">{t.pesoIndividual}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => abrirEdicao(t)}
                    className="mr-3 text-sky-600 hover:underline"
                  >
                    Editar
                  </button>
                  <button onClick={() => excluir(t)} className="text-red-600 hover:underline">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {!loading && ordenados.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  Nenhum tipo de documento cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? "Editar tipo de documento" : "Novo tipo de documento"}
      >
        <form onSubmit={salvar} className="space-y-4">
          <FormRow label="Código">
            <Input
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              required
            />
          </FormRow>
          <FormRow label="Descrição">
            <Input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              required
            />
          </FormRow>
          <FormRow label="Peso individual (para o cálculo do dashboard)">
            <Input
              type="number"
              min="0"
              value={form.pesoIndividual}
              onChange={(e) => setForm({ ...form, pesoIndividual: Number(e.target.value) })}
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

export default function DocumentosPage() {
  return (
    <ProtectedPage perfis={["administrador"]}>
      <DocumentosPageContent />
    </ProtectedPage>
  );
}
