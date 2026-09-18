"use client";

import { useState } from "react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input } from "@/components/ui/Field";
import { criarAtividadeId } from "@/lib/escopo";
import type { Escopo, EscopoAtividade } from "@/types";

function EscopoForm({ escopo, onClose }: { escopo: Escopo | null; onClose: () => void }) {
  const [nome, setNome] = useState(escopo?.nome ?? "");
  const [atividades, setAtividades] = useState<EscopoAtividade[]>(escopo?.atividades ?? []);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function adicionar() {
    setAtividades((prev) => [...prev, { id: criarAtividadeId(), descricao: "" }]);
  }

  function remover(id: string) {
    setAtividades((prev) => prev.filter((a) => a.id !== id));
  }

  function atualizar(id: string, descricao: string) {
    setAtividades((prev) => prev.map((a) => (a.id === id ? { ...a, descricao } : a)));
  }

  function mover(index: number, direcao: -1 | 1) {
    setAtividades((prev) => {
      const alvo = index + direcao;
      if (alvo < 0 || alvo >= prev.length) return prev;
      const copia = [...prev];
      const [item] = copia.splice(index, 1);
      copia.splice(alvo, 0, item);
      return copia;
    });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) {
      setErro("Informe o nome do escopo.");
      return;
    }
    const atividadesValidas = atividades
      .filter((a) => a.descricao.trim())
      .map((a) => ({ ...a, descricao: a.descricao.trim() }));
    if (atividadesValidas.length === 0) {
      setErro("Adicione ao menos uma atividade.");
      return;
    }
    setSalvando(true);
    try {
      const dados = { nome: nome.trim(), atividades: atividadesValidas };
      if (escopo) {
        await updateDoc(doc(db, "escopos", escopo.id), dados);
      } else {
        await addDoc(collection(db, "escopos"), { ...dados, createdAt: serverTimestamp() });
      }
      onClose();
    } catch (err) {
      console.error("Falha ao salvar escopo:", err);
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <FormRow label="Nome do escopo">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Escopo padrão de implantação QRH"
          required
          autoFocus
        />
      </FormRow>

      <div>
        <p className="mb-1.5 text-sm font-medium text-brand-navy-2">Atividades</p>
        <div className="max-h-[400px] space-y-1.5 overflow-y-auto rounded-md border border-brand-border p-2">
          {atividades.map((a, i) => (
            <div key={a.id} className="flex items-center gap-1.5">
              <span className="w-5 shrink-0 text-right text-[11px] text-brand-faint">{i + 1}</span>
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  aria-label="Mover para cima"
                  className="text-brand-faint hover:text-brand-accent disabled:opacity-25"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === atividades.length - 1}
                  aria-label="Mover para baixo"
                  className="text-brand-faint hover:text-brand-accent disabled:opacity-25"
                >
                  <ArrowDown size={12} />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <Input
                  value={a.descricao}
                  onChange={(e) => atualizar(a.id, e.target.value)}
                  placeholder="Descrição da atividade"
                />
              </div>
              <button
                type="button"
                onClick={() => remover(a.id)}
                className="shrink-0 text-brand-faint hover:text-red-600"
                aria-label="Remover atividade"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {atividades.length === 0 && (
            <p className="px-1 py-2 text-xs text-brand-faint">Nenhuma atividade adicionada ainda.</p>
          )}
        </div>
        <button
          type="button"
          onClick={adicionar}
          className="mt-2 text-sm font-medium text-brand-accent hover:underline"
        >
          + Adicionar atividade
        </button>
      </div>

      {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

export function EscopoFormModal({
  escopo,
  open,
  onClose,
}: {
  escopo: Escopo | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={escopo ? "Editar escopo" : "Novo escopo"} wide>
      {open && <EscopoForm key={escopo?.id ?? "novo"} escopo={escopo} onClose={onClose} />}
    </Modal>
  );
}
