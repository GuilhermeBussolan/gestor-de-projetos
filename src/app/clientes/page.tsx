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
import { CadastrosTabs } from "@/components/layout/CadastrosTabs";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormRow, Input } from "@/components/ui/Field";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { ImportarClientesModal } from "@/components/importacao/ImportarClientesModal";
import { Upload } from "lucide-react";
import type { Cliente } from "@/types";

const CLIENTE_VAZIO = {
  nome: "",
  nomeFantasia: "",
  cnpj: "",
  codigoCI: "",
};

function ClientesPageContent() {
  const { data: clientes, loading } = useCollection<Cliente>("clientes");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState(CLIENTE_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false);

  function abrirNovo() {
    setEditando(null);
    setForm(CLIENTE_VAZIO);
    setModalAberto(true);
  }

  function abrirEdicao(cliente: Cliente) {
    setEditando(cliente);
    setForm({
      nome: cliente.nome,
      nomeFantasia: cliente.nomeFantasia ?? "",
      cnpj: cliente.cnpj ?? "",
      codigoCI: cliente.codigoCI ?? "",
    });
    setModalAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const dados = {
        nome: form.nome,
        nomeFantasia: form.nomeFantasia || null,
        cnpj: form.cnpj || null,
        codigoCI: form.codigoCI || null,
      };
      if (editando) {
        await updateDoc(doc(db, "clientes", editando.id), dados);
      } else {
        await addDoc(collection(db, "clientes"), { ...dados, createdAt: Date.now() });
      }
      setModalAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(cliente: Cliente) {
    if (!confirm(`Excluir o cliente "${nomeExibicaoCliente(cliente)}"?`)) return;
    await deleteDoc(doc(db, "clientes", cliente.id));
  }

  return (
    <div>
      <CadastrosTabs />
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Clientes</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportarAberto(true)}>
            <Upload size={15} /> Importar
          </Button>
          <Button onClick={abrirNovo}>+ Novo cliente</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="bg-brand-hover text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
              <th className="px-[18px] py-3.5">Nome</th>
              <th className="px-[18px] py-3.5">Nome fantasia</th>
              <th className="px-[18px] py-3.5">CNPJ</th>
              <th className="px-[18px] py-3.5">Código CI</th>
              <th className="px-[18px] py-3.5" />
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-t border-brand-border-soft hover:bg-brand-hover">
                <td className="px-[18px] py-[15px] font-bold text-brand-navy-2">{c.nome}</td>
                <td className="px-[18px] py-[15px] text-brand-muted">{c.nomeFantasia || "—"}</td>
                <td className="px-[18px] py-[15px] text-brand-muted">{c.cnpj || "—"}</td>
                <td className="px-[18px] py-[15px] text-brand-muted">{c.codigoCI || "—"}</td>
                <td className="px-[18px] py-[15px] text-right">
                  <button
                    onClick={() => abrirEdicao(c)}
                    className="mr-3 text-brand-accent hover:underline"
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
                <td colSpan={4} className="px-4 py-8 text-center text-brand-faint">
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
          <FormRow label="Nome">
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Razão social ou nome do cliente"
              required
            />
          </FormRow>
          <FormRow label="Nome fantasia (opcional)">
            <Input
              value={form.nomeFantasia}
              onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
            />
          </FormRow>
          <FormRow label="CNPJ (opcional)">
            <Input
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
            />
          </FormRow>
          <FormRow label="Código CI (controle interno, opcional)">
            <Input
              value={form.codigoCI}
              onChange={(e) => setForm({ ...form, codigoCI: e.target.value })}
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

      <ImportarClientesModal
        open={importarAberto}
        onClose={() => setImportarAberto(false)}
        clientesExistentes={clientes}
      />
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
