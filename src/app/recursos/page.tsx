"use client";

import { useState } from "react";
import { collection, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { COLECAO_VALOR_RECURSO, salvarValorHoraRecurso, useRecursos } from "@/lib/dadosProtegidos";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { CadastrosTabs } from "@/components/layout/CadastrosTabs";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { ThOrdenavel, useOrdenacao } from "@/components/ui/Ordenacao";
import { TIPO_BOX_CONFIG, TIPO_RECURSO_CONFIG } from "@/lib/constants";
import { nomeExibicaoParceira } from "@/lib/parceira";
import { recursoAtivo } from "@/lib/recursoAtivo";
import type { EmpresaParceira, Recurso, TipoBox, TipoRecurso } from "@/types";

const RECURSO_VAZIO = {
  tipo: "consultor_funcional" as TipoRecurso,
  nomeCompleto: "",
  codigo: "",
  valorHora: "",
  tipoBox: "proprio" as TipoBox,
  parceiraId: "",
  ativo: true,
  dataInativacao: "",
};

const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

function RecursosPageContent() {
  const { data: recursos, loading } = useRecursos();
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
      ativo: recursoAtivo(r),
      dataInativacao: r.dataInativacao ?? "",
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
    if (!form.ativo && !form.dataInativacao) {
      setErro("Informe a data de inativação do recurso.");
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        tipo: form.tipo,
        nomeCompleto: form.nomeCompleto,
        codigo: form.codigo,
        tipoBox: form.tipoBox,
        parceiraId: form.tipoBox === "terceiro" ? form.parceiraId : null,
        ativo: form.ativo,
        dataInativacao: form.ativo ? null : form.dataInativacao,
      };
      // O valor/hora fica em recursosValores (só admin e financeiro leem); o resto do cadastro, em recursos.
      const lote = writeBatch(db);
      const ref = editando ? doc(db, "recursos", editando.id) : doc(collection(db, "recursos"));
      if (editando) lote.update(ref, dados);
      else lote.set(ref, { ...dados, createdAt: Date.now() });
      await salvarValorHoraRecurso(ref.id, Number(form.valorHora) || 0, lote);
      await lote.commit();
      setModalAberto(false);
    } catch (err) {
      console.error("Falha ao salvar recurso:", err);
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const nomeParceira = (r: Recurso) => nomeExibicaoParceira(parceiras.find((p) => p.id === r.parceiraId));
  const { ordenados, ordem, ordenar } = useOrdenacao(recursos, {
    categoria: (r) => TIPO_RECURSO_CONFIG[r.tipo].label,
    nome: (r) => r.nomeCompleto,
    codigo: (r) => r.codigo,
    valorHora: (r) => r.valorHora,
    box: (r) => ((r.tipoBox ?? "proprio") === "terceiro" ? `Terceiro — ${nomeParceira(r)}` : "Próprio"),
    situacao: (r) => (recursoAtivo(r) ? "0" : `1 ${r.dataInativacao ?? ""}`),
  });

  async function excluir(r: Recurso) {
    if (!confirm(`Excluir o recurso "${r.nomeCompleto}"?`)) return;
    await deleteDoc(doc(db, "recursos", r.id));
    await deleteDoc(doc(db, COLECAO_VALOR_RECURSO, r.id)).catch(() => {});
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
              <ThOrdenavel chave="categoria" ordem={ordem} onOrdenar={ordenar} className="px-[18px] py-3.5">Categoria</ThOrdenavel>
              <ThOrdenavel chave="nome" ordem={ordem} onOrdenar={ordenar} className="px-[18px] py-3.5">Nome completo</ThOrdenavel>
              <ThOrdenavel chave="codigo" ordem={ordem} onOrdenar={ordenar} className="px-[18px] py-3.5">Código</ThOrdenavel>
              <ThOrdenavel chave="valorHora" ordem={ordem} onOrdenar={ordenar} className="px-[18px] py-3.5">Valor/hora</ThOrdenavel>
              <ThOrdenavel chave="box" ordem={ordem} onOrdenar={ordenar} className="px-[18px] py-3.5">BOX</ThOrdenavel>
              <ThOrdenavel chave="situacao" ordem={ordem} onOrdenar={ordenar} className="px-[18px] py-3.5">Situação</ThOrdenavel>
              <th className="px-[18px] py-3.5" />
            </tr>
          </thead>
          <tbody>
            {ordenados.map((r) => (
              <tr key={r.id} className={`border-t border-brand-border-soft hover:bg-brand-hover ${recursoAtivo(r) ? "" : "opacity-60"}`}>
                <td className="px-[18px] py-[15px] text-brand-muted">{TIPO_RECURSO_CONFIG[r.tipo].label}</td>
                <td className="px-[18px] py-[15px] font-bold text-brand-navy-2">{r.nomeCompleto}</td>
                <td className="px-[18px] py-[15px] text-brand-muted">{r.codigo}</td>
                <td className="px-[18px] py-[15px] text-brand-navy-2">
                  {r.valorHora.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-[18px] py-[15px] text-brand-muted">
                  {(r.tipoBox ?? "proprio") === "terceiro"
                    ? `Terceiro — ${nomeParceira(r)}`
                    : "Próprio"}
                </td>
                <td className="px-[18px] py-[15px] whitespace-nowrap">
                  {recursoAtivo(r) ? (
                    <span className="rounded-full bg-[#e3f5ea] px-2.5 py-0.5 text-[11px] font-bold text-[#15754c]">Ativo</span>
                  ) : (
                    <span
                      className="rounded-full bg-[#f1f2f6] px-2.5 py-0.5 text-[11px] font-bold text-[#6a7594]"
                      title="Apontamentos só até a data de inativação"
                    >
                      Inativo{r.dataInativacao ? ` desde ${dataBR(r.dataInativacao)}` : ""}
                    </span>
                  )}
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
                <td colSpan={7} className="px-4 py-8 text-center text-brand-faint">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormRow label="Situação">
              <Select
                value={form.ativo ? "ativo" : "inativo"}
                onChange={(e) => {
                  const ativo = e.target.value === "ativo";
                  setForm({ ...form, ativo, dataInativacao: ativo ? "" : form.dataInativacao || hojeIso() });
                }}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </Select>
            </FormRow>
            {!form.ativo && (
              <FormRow label="Data de inativação">
                <Input type="date" value={form.dataInativacao} onChange={(e) => setForm({ ...form, dataInativacao: e.target.value })} required />
              </FormRow>
            )}
          </div>
          {!form.ativo && (
            <p className="-mt-2 text-[12px] text-brand-muted">
              Apontamentos até {form.dataInativacao ? dataBR(form.dataInativacao) : "essa data"} (inclusive) continuam permitidos; depois dela, não.
            </p>
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
