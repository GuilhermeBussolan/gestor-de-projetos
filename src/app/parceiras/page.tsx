"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { CadastrosTabs } from "@/components/layout/CadastrosTabs";
import { Button } from "@/components/ui/Button";
import { FormRow, Input } from "@/components/ui/Field";
import { ContatosParceiraFields } from "@/components/parceiras/ContatosParceiraFields";
import { cnpjValido, formatarCnpj } from "@/lib/cnpj";
import { nomeExibicaoParceira } from "@/lib/parceira";
import type { ContatoParceira, EmpresaParceira } from "@/types";

const PARCEIRA_VAZIA = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  contatos: [] as ContatoParceira[],
};

function ParceirasPageContent() {
  const { data: parceiras, loading } = useCollection<EmpresaParceira>("parceiras");
  const [visualizacao, setVisualizacao] = useState<"lista" | "formulario">("lista");
  const [editando, setEditando] = useState<EmpresaParceira | null>(null);
  const [form, setForm] = useState(PARCEIRA_VAZIA);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function abrirNova() {
    setEditando(null);
    setForm(PARCEIRA_VAZIA);
    setErro("");
    setVisualizacao("formulario");
  }

  function abrirEdicao(p: EmpresaParceira) {
    setEditando(p);
    setForm({
      razaoSocial: p.razaoSocial,
      nomeFantasia: p.nomeFantasia,
      cnpj: p.cnpj,
      contatos: p.contatos ?? [],
    });
    setErro("");
    setVisualizacao("formulario");
  }

  function limpar() {
    setForm(editando ? { ...PARCEIRA_VAZIA } : PARCEIRA_VAZIA);
    setErro("");
  }

  function voltar() {
    setVisualizacao("lista");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!form.razaoSocial.trim() || !form.nomeFantasia.trim() || !form.cnpj.trim()) {
      setErro("Razão social, nome fantasia e CNPJ são obrigatórios.");
      return;
    }
    if (!cnpjValido(form.cnpj)) {
      setErro("CNPJ inválido.");
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim(),
        cnpj: formatarCnpj(form.cnpj),
        contatos: form.contatos.filter((c) => c.nome.trim() || c.email?.trim() || c.telefone?.trim()),
        updatedAt: Date.now(),
      };
      if (editando) {
        await updateDoc(doc(db, "parceiras", editando.id), dados);
      } else {
        await addDoc(collection(db, "parceiras"), { ...dados, createdAt: Date.now() });
      }
      setVisualizacao("lista");
    } catch (err) {
      console.error("Falha ao salvar empresa parceira:", err);
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(p: EmpresaParceira) {
    if (!confirm(`Excluir a empresa parceira "${nomeExibicaoParceira(p)}"?`)) return;
    await deleteDoc(doc(db, "parceiras", p.id));
  }

  if (visualizacao === "formulario") {
    return (
      <div>
        <CadastrosTabs />
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">
            {editando ? "Editar empresa parceira" : "Nova empresa parceira"}
          </h1>
        </div>

        <form onSubmit={salvar} className="max-w-2xl space-y-5 rounded-2xl border border-brand-border bg-white p-6 shadow-card">
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
              placeholder="00.000.000/0000-00"
              required
            />
          </FormRow>

          <ContatosParceiraFields
            contatos={form.contatos}
            onChange={(contatos) => setForm({ ...form, contatos })}
          />

          {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={voltar}>
              Voltar
            </Button>
            <Button type="button" variant="secondary" onClick={limpar}>
              Limpar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <CadastrosTabs />
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Empresas parceiras</h1>
        <Button onClick={abrirNova}>+ Nova parceira</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="bg-brand-hover text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
              <th className="px-[18px] py-3.5">Razão social</th>
              <th className="px-[18px] py-3.5">Nome fantasia</th>
              <th className="px-[18px] py-3.5">CNPJ</th>
              <th className="px-[18px] py-3.5">Contatos</th>
              <th className="px-[18px] py-3.5" />
            </tr>
          </thead>
          <tbody>
            {parceiras.map((p) => (
              <tr key={p.id} className="border-t border-brand-border-soft hover:bg-brand-hover">
                <td className="px-[18px] py-[15px] font-bold text-brand-navy-2">{p.razaoSocial}</td>
                <td className="px-[18px] py-[15px] text-brand-muted">{p.nomeFantasia}</td>
                <td className="px-[18px] py-[15px] text-brand-muted">{p.cnpj}</td>
                <td className="px-[18px] py-[15px] text-brand-muted">
                  {(p.contatos ?? []).length === 0
                    ? "—"
                    : (p.contatos ?? []).map((c) => c.nome).filter(Boolean).join(", ")}
                </td>
                <td className="px-[18px] py-[15px] text-right">
                  <button
                    onClick={() => abrirEdicao(p)}
                    className="mr-3 text-brand-accent hover:underline"
                  >
                    Editar
                  </button>
                  <button onClick={() => excluir(p)} className="text-red-600 hover:underline">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {!loading && parceiras.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-brand-faint">
                  Nenhuma empresa parceira cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ParceirasPage() {
  return (
    <ProtectedPage perfis={["administrador"]}>
      <ParceirasPageContent />
    </ProtectedPage>
  );
}
