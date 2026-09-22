"use client";

import { useMemo, useState } from "react";
import { CheckSquare, ListTree, Minus, Square } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import {
  alternarBlocoIncluido,
  estadoMarcacao,
  idsFolhas,
  nivelAtividade,
  normalizarNiveis,
  numerarAtividades,
} from "@/lib/escopo";
import type { Escopo, EscopoAtividade, ExclusaoEscopo } from "@/types";

type Modo = "escolha" | "personalizar";

function CaixaMarca({ estado }: { estado: "marcada" | "parcial" | "vazia" }) {
  if (estado === "marcada") return <CheckSquare size={16} className="shrink-0 text-brand-accent" />;
  if (estado === "parcial") return <Minus size={16} className="shrink-0 text-brand-accent" />;
  return <Square size={16} className="shrink-0 text-brand-faint" />;
}

/**
 * Ao incluir um escopo no projeto: tudo de uma vez ("Incluir completo") ou desmarcando tarefas
 * pai para excluir a hierarquia inteira delas ("Personalizar exclusões") — 3.1.
 */
export function EscopoInclusaoModal({
  escopo,
  onClose,
  onConfirmar,
}: {
  escopo: Escopo | null;
  onClose: () => void;
  onConfirmar: (atividades: EscopoAtividade[], exclusoes: ExclusaoEscopo[], usuarioNome: string) => void | Promise<void>;
}) {
  const [modo, setModo] = useState<Modo>("escolha");
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const atividades = useMemo(() => escopo?.atividades ?? [], [escopo]);
  const numeracao = useMemo(() => numerarAtividades(atividades), [atividades]);
  const folhas = useMemo(() => idsFolhas(atividades), [atividades]);
  const folhasIncluidas = useMemo(
    () => [...folhas].filter((id) => marcadas.has(id)).length,
    [folhas, marcadas]
  );

  function abrirPersonalizacao() {
    setMarcadas(new Set(atividades.map((a) => a.id)));
    setModo("personalizar");
  }

  function alternar(id: string) {
    setMarcadas(new Set(alternarBlocoIncluido(atividades, Array.from(marcadas), id)));
  }

  function fechar() {
    setModo("escolha");
    setMarcadas(new Set());
    setErro("");
    onClose();
  }

  async function confirmar(atividadesFinal: EscopoAtividade[], excluidas: EscopoAtividade[], usuarioNome: string) {
    setSalvando(true);
    setErro("");
    try {
      const criadoEm = Date.now();
      const exclusoes: ExclusaoEscopo[] = excluidas.map((a) => ({
        atividadeId: a.id,
        descricao: a.descricao,
        usuarioNome,
        criadoEm,
      }));
      await onConfirmar(normalizarNiveis(atividadesFinal), exclusoes, usuarioNome);
      fechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível incluir o escopo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open={!!escopo} onClose={fechar} title="Incluir escopo no projeto" wide>
      {escopo && modo === "escolha" && (
        <div className="space-y-4">
          <p className="text-sm text-brand-muted">
            Escopo <strong className="text-brand-navy-2">{escopo.nome}</strong> — {folhas.size}{" "}
            atividade{folhas.size === 1 ? "" : "s"}.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ConfirmarCompletoBotao
              disabled={salvando}
              onConfirmar={(usuarioNome) => confirmar(atividades, [], usuarioNome)}
            />
            <button
              type="button"
              onClick={abrirPersonalizacao}
              className="flex flex-col items-start gap-1.5 rounded-2xl border border-brand-border bg-white p-4 text-left transition-colors hover:border-brand-accent hover:bg-brand-accent-soft/30"
            >
              <ListTree size={20} className="text-brand-accent" />
              <span className="font-bold text-brand-navy-2">Personalizar exclusões</span>
              <span className="text-[12.5px] text-brand-muted">
                Escolha quais tarefas ficam de fora antes de incluir.
              </span>
            </button>
          </div>
          {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={fechar}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {escopo && modo === "personalizar" && (
        <div className="space-y-4">
          <p className="text-sm text-brand-muted">
            Desmarque uma tarefa pai para excluir toda a hierarquia dela. Tarefas incluídas:{" "}
            <strong className="text-brand-navy-2">
              {folhasIncluidas} de {folhas.size}
            </strong>
            .
          </p>
          <div className="max-h-[360px] overflow-y-auto rounded-xl border border-brand-border">
            {atividades.map((a, i) => (
              <button
                key={a.id}
                type="button"
                onClick={() => alternar(a.id)}
                className={`flex w-full items-center gap-2.5 border-t border-brand-border-soft px-3 py-2 text-left text-[12.5px] first:border-t-0 hover:bg-brand-hover ${
                  nivelAtividade(a) === 0 ? "font-bold text-brand-navy-2" : "text-brand-muted"
                }`}
                style={{ paddingLeft: 12 + nivelAtividade(a) * 20 }}
              >
                <CaixaMarca estado={estadoMarcacao(atividades, marcadas, i)} />
                <span className="text-brand-faint">{numeracao[i]}</span>
                {a.descricao}
              </button>
            ))}
          </div>
          {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={() => setModo("escolha")}
              className="text-[12.5px] font-semibold text-brand-accent hover:underline"
            >
              Voltar
            </button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={fechar}>
                Cancelar
              </Button>
              <ConfirmarPersonalizadoBotao
                disabled={salvando || folhasIncluidas === 0}
                onConfirmar={(usuarioNome) => {
                  const final = atividades.filter((a) => marcadas.has(a.id));
                  const excluidas = atividades.filter((a) => !marcadas.has(a.id));
                  return confirmar(final, excluidas, usuarioNome);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ConfirmarCompletoBotao({
  disabled,
  onConfirmar,
}: {
  disabled: boolean;
  onConfirmar: (usuarioNome: string) => void | Promise<void>;
}) {
  const { usuario } = useAuth();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onConfirmar(usuario?.nomeCompleto ?? "")}
      className="flex flex-col items-start gap-1.5 rounded-2xl border border-brand-accent bg-brand-accent-soft/40 p-4 text-left transition-colors hover:bg-brand-accent-soft disabled:opacity-60"
    >
      <CheckSquare size={20} className="text-brand-accent" />
      <span className="font-bold text-brand-navy-2">Incluir completo</span>
      <span className="text-[12.5px] text-brand-muted">Todas as atividades do escopo, sem exclusões.</span>
    </button>
  );
}

function ConfirmarPersonalizadoBotao({
  disabled,
  onConfirmar,
}: {
  disabled: boolean;
  onConfirmar: (usuarioNome: string) => void | Promise<void>;
}) {
  const { usuario } = useAuth();
  return (
    <Button type="button" disabled={disabled} onClick={() => onConfirmar(usuario?.nomeCompleto ?? "")}>
      Confirmar seleção
    </Button>
  );
}
