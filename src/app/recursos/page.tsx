"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { CadastrosTabs } from "@/components/layout/CadastrosTabs";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { TIPO_BOX_CONFIG, TIPO_RECURSO_CONFIG } from "@/lib/constants";
import { nomeExibicaoParceira } from "@/lib/parceira";
import type { EmpresaParceira, Recurso, TipoBox, TipoRecurso } from "@/types";

const RECURSO_VAZIO = {
  tipo: "consultor_funcional" as TipoRecurso,
  nomeCompleto: "",
  codigo: "",
  valorHora: "",
  tipoBox: "proprio" as TipoBox,
  parceiraId: "",
};

function RecursosPageContent() {
  const { data: recursos, loading } = useCollection<Recurso>("recursos");
  const { data: parceiras } = useCollection<EmpresaParceira>("parceiras");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Recurso | null>(null);
  const [form, setForm] = useState(RECURSO_VAZIO);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() {
    setEditando(null);
    setForm(RECURSO_VAZIO);
    setErro("");
    setModalAberto(true);
  }

  function abrirEdicao(r: Recurso) {
    setEditando(r);
    setForm({
      tipo: r.tipo,
      nomeCompleto: r.nomeCompleto,
      codigo: r.codigo,
      valorHora: String(r.valorHora),
      tipoBox: r.tipoBox ?? "proprio",
      parceiraId: r.parceiraId ?? "",
    });
    setErro("");
    setModalAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (form.tipoBox === "terceiro" && !form.parceiraId) {
      setErro("Selecione a empresa parceira para um recurso BOX Terceiro.");
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        tipo: form.tipo,
        nomeCompleto: form.nomeCompleto,
        codigo: form.codigo,
        valorHora: Number(form.valorHora) || 0,
        tipoBox: form.tipoBox,
        parceiraId: form.tipoBox === "terceiro" ? form.parceiraId : null,
      };
      if (editando) {
        await updateDoc(doc(db, "recursos", editando.id), dados);
      } else {
        await addDoc(collection(db, "recursos"), { ...dados, createdAt: Date.now() });
      }
      setModalAberto(false);
    } catch (err) {
      console.error("Falha ao salvar recurso:", err);
      setErro("Não foi possível salvar. Tente novamente.");
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
      <CadastrosTabs />
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Recursos</h1>
        <Button onClick={abrirNovo}>+ Novo recurso</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="bg-brand-hover text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
              <th className="px-[18px] py-3.5">Categoria</th>
              <th className="px-[18px] py-3.5">Nome completo</th>
              <th className="px-[18px] py-3.5">Código</th>
              <th className="px-[18px] py-3.5">Valor/hora</th>
              <th className="px-[18px] py-3.5">BOX</th>
              <th className="px-[18px] py-3.5" />
            </tr>
          </thead>
          <tbody>
            {recursos.map((r) => (
              <tr key={r.id} className="border-t border-brand-border-soft hover:bg-brand-hover">
                <td className="px-[18px] py-[15px] text-brand-muted">{TIPO_RECURSO_CONFIG[r.tipo].label}</td>
                <td className="px-[18px] py-[15px] font-bold text-brand-navy-2">{r.nomeCompleto}</td>
                <td className="px-[18px] py-[15px] text-brand-muted">{r.codigo}</td>
                <td className="px-[18px] py-[15px] text-brand-navy-2">
                  {r.valorHora.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-[18px] py-[15px] text-brand-muted">
                  {(r.tipoBox ?? "proprio") === "terceiro"
                    ? `Terceiro — ${nomeExibicaoParceira(parceiras.find((p) => p.id === r.parceiraId))}`
                    : "Próprio"}
                </td>
                <td className="px-[18px] py-[15px] text-right">
                  <button
                    onClick={() => abrirEdicao(r)}
                    className="mr-3 text-brand-accent hover:underline"
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
                <td colSpan={6} className="px-4 py-8 text-center text-brand-faint">
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

          <div>
            <p className="mb-1.5 text-xs font-semibold text-brand-muted">BOX</p>
            <div className="flex gap-4">
              {(Object.keys(TIPO_BOX_CONFIG) as TipoBox[]).map((valor) => (
                <label key={valor} className="flex items-center gap-2 text-[13.5px] text-brand-navy-2">
                  <input
                    type="radio"
                    name="tipoBox"
                    checked={form.tipoBox === valor}
                    onChange={() => setForm({ ...form, tipoBox: valor })}
                  />
                  {TIPO_BOX_CONFIG[valor].label}
                </label>
              ))}
            </div>
          </div>

          {form.tipoBox === "terceiro" && (
            <FormRow label="Empresa parceira">
              <Select
                value={form.parceiraId}
                onChange={(e) => setForm({ ...form, parceiraId: e.target.value })}
                required
              >
                <option value="">Selecione...</option>
                {parceiras.map((p) => (
                  <option key={p.id} value={p.id}>
                    {nomeExibicaoParceira(p)}
                  </option>
                ))}
              </Select>
              {parceiras.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  Nenhuma empresa parceira cadastrada — cadastre em Cadastros → Parceiras.
                </p>
              )}
            </FormRow>
          )}

          {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

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
