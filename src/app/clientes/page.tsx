"use client";

import { useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { MODULOS, TIPOS_ATENDIMENTO, type Cliente, type Modulo, type TipoAtendimento } from "@/types";

const CLIENTE_VAZIO: {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  codigoProposta: string;
  modulo: Modulo;
  tipoAtendimento: TipoAtendimento;
} = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  codigoProposta: "",
  modulo: MODULOS[0],
  tipoAtendimento: TIPOS_ATENDIMENTO[0],
};

function ClientesPageContent() {
  const { data: clientes, loading } = useCollection<Cliente>("clientes");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState(CLIENTE_VAZIO);
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() {
    setEditando(null);
    setForm(CLIENTE_VAZIO);
    setModalAberto(true);
  }

  function abrirEdicao(cliente: Cliente) {
    setEditando(cliente);
    setForm({
      razaoSocial: cliente.razaoSocial,
      nomeFantasia: cliente.nomeFantasia,
      cnpj: cliente.cnpj,
      codigoProposta: cliente.codigoProposta,
      modulo: cliente.modulo,
      tipoAtendimento: cliente.tipoAtendimento,
    });
    setModalAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      if (editando) {
        await updateDoc(doc(db, "clientes", editando.id), { ...form });
      } else {
        await addDoc(collection(db, "clientes"), { ...form, createdAt: Date.now() });
      }
      setModalAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(cliente: Cliente) {
    if (!confirm(`Excluir o cliente "${cliente.nomeFantasia}"?`)) return;
    await deleteDoc(doc(db, "clientes", cliente.id));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Clientes</h1>
        <Button onClick={abrirNovo}>+ Novo cliente</Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Razão social</th>
              <th className="px-4 py-3">Nome fantasia</th>
              <th className="px-4 py-3">CNPJ</th>
              <th className="px-4 py-3">Proposta</th>
              <th className="px-4 py-3">Módulo</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clientes.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{c.razaoSocial}</td>
                <td className="px-4 py-3">{c.nomeFantasia}</td>
                <td className="px-4 py-3">{c.cnpj}</td>
                <td className="px-4 py-3">{c.codigoProposta}</td>
                <td className="px-4 py-3">{c.modulo}</td>
                <td className="px-4 py-3">{c.tipoAtendimento}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => abrirEdicao(c)}
                    className="mr-3 text-sky-600 hover:underline"
                  >
                    Editar
                  </button>
                  <button onClick={() => excluir(c)} className="text-red-600 hover:underline">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {!loading && clientes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhum cliente cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? "Editar cliente" : "Novo cliente"}
      >
        <form onSubmit={salvar} className="space-y-4">
          <FormRow label="Razão social">
            <Input
              value={form.razaoSocial}
              onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
              required
            />
          </FormRow>
          <FormRow label="Nome fantasia">
            <Input
              value={form.nomeFantasia}
              onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
              required
            />
          </FormRow>
          <FormRow label="CNPJ">
            <Input
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              required
            />
          </FormRow>
          <FormRow label="Código da proposta">
            <Input
              value={form.codigoProposta}
              onChange={(e) => setForm({ ...form, codigoProposta: e.target.value })}
              required
            />
          </FormRow>
          <FormRow label="Módulo de atendimento">
            <Select
              value={form.modulo}
              onChange={(e) => setForm({ ...form, modulo: e.target.value as Modulo })}
            >
              {MODULOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="Tipo de atendimento">
            <Select
              value={form.tipoAtendimento}
              onChange={(e) =>
                setForm({ ...form, tipoAtendimento: e.target.value as TipoAtendimento })
              }
            >
              {TIPOS_ATENDIMENTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
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

export default function ClientesPage() {
  return (
    <ProtectedPage perfis={["administrador"]}>
      <ClientesPageContent />
    </ProtectedPage>
  );
}
