"use client";

import { useState } from "react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowDown, ArrowUp, IndentDecrease, IndentIncrease, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input } from "@/components/ui/Field";
import {
  criarAtividadeId,
  fimDoBloco,
  irmaoAnterior,
  irmaoSeguinte,
  nivelAtividade,
  normalizarNiveis,
  numerarAtividades,
} from "@/lib/escopo";
import type { Escopo, EscopoAtividade } from "@/types";

function EscopoForm({ escopo, onClose }: { escopo: Escopo | null; onClose: () => void }) {
  const [nome, setNome] = useState(escopo?.nome ?? "");
  const [atividades, setAtividades] = useState<EscopoAtividade[]>(
    normalizarNiveis(escopo?.atividades ?? [])
  );
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const numeracao = numerarAtividades(atividades);

  function adicionar() {
    setAtividades((prev) => {
      const nivel = prev.length > 0 ? nivelAtividade(prev[prev.length - 1]) : 0;
      return [...prev, { id: criarAtividadeId(), descricao: "", nivel }];
    });
  }

  // Ao remover um pai, os filhos sobem um nível (não somem junto).
  function remover(indice: number) {
    setAtividades((prev) => {
      const fim = fimDoBloco(prev, indice);
      const resultado = prev
        .filter((_, i) => i !== indice)
        .map((a, i) => {
          const original = i + (i >= indice ? 1 : 0);
          return original > indice && original < fim
            ? { ...a, nivel: Math.max(0, nivelAtividade(a) - 1) }
            : a;
        });
      return normalizarNiveis(resultado);
    });
  }

  function atualizar(id: string, descricao: string) {
    setAtividades((prev) => prev.map((a) => (a.id === id ? { ...a, descricao } : a)));
  }

  // Mover leva o bloco inteiro (pai + filhos) trocando de lugar com o irmão vizinho.
  function mover(indice: number, direcao: -1 | 1) {
    setAtividades((prev) => {
      const fim = fimDoBloco(prev, indice);
      if (direcao === -1) {
        const anterior = irmaoAnterior(prev, indice);
        if (anterior === null) return prev;
        return [...prev.slice(0, anterior), ...prev.slice(indice, fim), ...prev.slice(anterior, indice), ...prev.slice(fim)];
      }
      const proximo = irmaoSeguinte(prev, indice);
      if (proximo === null) return prev;
      const fimProximo = fimDoBloco(prev, proximo);
      return [...prev.slice(0, indice), ...prev.slice(proximo, fimProximo), ...prev.slice(indice, fim), ...prev.slice(fimProximo)];
    });
  }

  // Recuar/avançar também leva o bloco (filhos mantêm o nível relativo).
  function mudarNivel(indice: number, delta: -1 | 1) {
    setAtividades((prev) => {
      const nivel = nivelAtividade(prev[indice]);
      if (delta === 1 && (indice === 0 || nivel > nivelAtividade(prev[indice - 1]))) return prev;
      if (delta === -1 && nivel === 0) return prev;
      const fim = fimDoBloco(prev, indice);
      return normalizarNiveis(
        prev.map((a, i) => (i >= indice && i < fim ? { ...a, nivel: nivelAtividade(a) + delta } : a))
      );
    });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) {
      setErro("Informe o nome do escopo.");
      return;
    }
    const atividadesValidas = normalizarNiveis(
      atividades.filter((a) => a.descricao.trim()).map((a) => ({ ...a, descricao: a.descricao.trim() }))
    );
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

  const botao = "text-brand-faint hover:text-brand-accent disabled:opacity-25 disabled:hover:text-brand-faint";

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
        <p className="mb-1 text-sm font-medium text-brand-navy-2">Atividades</p>
        <p className="mb-1.5 text-[11.5px] text-brand-faint">
          Use as setas de recuo para transformar uma atividade em filha da anterior. Ao apontar, marcar o pai
          marca todos os filhos.
        </p>
        <div className="max-h-[400px] space-y-1.5 overflow-y-auto rounded-md border border-brand-border p-2">
          {atividades.map((a, i) => (
            <div
              key={a.id}
              className="flex items-center gap-1.5"
              style={{ paddingLeft: nivelAtividade(a) * 20 }}
            >
              <span className="w-10 shrink-0 text-right text-[11px] text-brand-faint">{numeracao[i]}</span>
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={irmaoAnterior(atividades, i) === null}
                  aria-label="Mover para cima"
                  className={botao}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={irmaoSeguinte(atividades, i) === null}
                  aria-label="Mover para baixo"
                  className={botao}
                >
                  <ArrowDown size={12} />
                </button>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <button
                  type="button"
                  onClick={() => mudarNivel(i, -1)}
                  disabled={nivelAtividade(a) === 0}
                  aria-label="Diminuir recuo (subir de nível)"
                  title="Subir de nível"
                  className={botao}
                >
                  <IndentDecrease size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => mudarNivel(i, 1)}
                  disabled={i === 0 || nivelAtividade(a) > nivelAtividade(atividades[i - 1])}
                  aria-label="Tornar filho da atividade acima (recuar)"
                  title="Tornar filho da atividade acima"
                  className={botao}
                >
                  <IndentIncrease size={14} />
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
                onClick={() => remover(i)}
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
