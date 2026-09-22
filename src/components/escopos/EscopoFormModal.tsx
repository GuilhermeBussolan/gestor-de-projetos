"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowDown, ArrowUp, IndentDecrease, IndentIncrease, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select } from "@/components/ui/Field";
import {
  criarAtividadeId,
  fimDoBloco,
  formatarMinutos,
  irmaoAnterior,
  irmaoSeguinte,
  moverBlocoVizinho,
  nivelAtividade,
  normalizarNiveis,
  numerarAtividades,
  somaDuracaoBloco,
  temFilhos,
} from "@/lib/escopo";
import type { Escopo, EscopoAtividade, UnidadeDuracao } from "@/types";

/** Largura de cada divisória arrastável — usada também como espaçador nas linhas, para tudo alinhar. */
const LARGURA_ALCA = 10;

const LIMITES = {
  descricao: { min: 160, max: 900, padrao: 380 },
  duracao: { min: 60, max: 220, padrao: 90 },
  unidade: { min: 60, max: 200, padrao: 90 },
} as const;

function larguraSalva(chave: keyof typeof LIMITES): number {
  try {
    const valor = Number(localStorage.getItem(`gp_escopo_largura_${chave}`));
    return valor > 0 ? Math.min(LIMITES[chave].max, Math.max(LIMITES[chave].min, valor)) : LIMITES[chave].padrao;
  } catch {
    return LIMITES[chave].padrao;
  }
}

/** Divisória arrastável entre duas colunas do cabeçalho — segura e arrasta para redimensionar. */
function AlcaColuna({ onArrastar }: { onArrastar: (deltaX: number) => void }) {
  const [arrastando, setArrastando] = useState(false);

  useEffect(() => {
    if (!arrastando) return;
    let ultimoX: number | null = null;
    function mover(e: MouseEvent) {
      if (ultimoX !== null) onArrastar(e.clientX - ultimoX);
      ultimoX = e.clientX;
    }
    function soltar() {
      setArrastando(false);
    }
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
    return () => {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
    };
  }, [arrastando, onArrastar]);

  return (
    <div
      onMouseDown={() => setArrastando(true)}
      title="Arrastar para redimensionar a coluna"
      style={{ width: LARGURA_ALCA }}
      className="flex shrink-0 items-center justify-center self-stretch"
    >
      <div className={`h-full w-1 cursor-col-resize rounded ${arrastando ? "bg-brand-accent" : "bg-brand-border hover:bg-brand-accent/50"}`} />
    </div>
  );
}

function EscopoForm({ escopo, onClose }: { escopo: Escopo | null; onClose: () => void }) {
  const [nome, setNome] = useState(escopo?.nome ?? "");
  const [atividades, setAtividades] = useState<EscopoAtividade[]>(
    normalizarNiveis(escopo?.atividades ?? [])
  );
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [larguraDescricao, setLarguraDescricao] = useState(() => larguraSalva("descricao"));
  const [larguraDuracao, setLarguraDuracao] = useState(() => larguraSalva("duracao"));
  const [larguraUnidade, setLarguraUnidade] = useState(() => larguraSalva("unidade"));

  function redimensionar(
    chave: keyof typeof LIMITES,
    setLargura: React.Dispatch<React.SetStateAction<number>>,
    deltaX: number
  ) {
    setLargura((atual) => {
      const nova = Math.min(LIMITES[chave].max, Math.max(LIMITES[chave].min, atual + deltaX));
      try {
        localStorage.setItem(`gp_escopo_largura_${chave}`, String(nova));
      } catch {
        // sem armazenamento: a coluna só não lembra o tamanho na próxima vez
      }
      return nova;
    });
  }

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

  function atualizarDuracao(id: string, texto: string) {
    setAtividades((prev) =>
      prev.map((a) => (a.id === id ? { ...a, duracao: texto ? Number(texto) : undefined } : a))
    );
  }

  function atualizarUnidade(id: string, unidadeDuracao: UnidadeDuracao) {
    setAtividades((prev) => prev.map((a) => (a.id === id ? { ...a, unidadeDuracao } : a)));
  }

  // Mover leva o bloco inteiro (pai + filhos) trocando de lugar com o irmão vizinho.
  function mover(indice: number, direcao: -1 | 1) {
    setAtividades((prev) => moverBlocoVizinho(prev, indice, direcao));
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
    const semDescricaoVazia = atividades.filter((a) => a.descricao.trim());
    // Atividade que virou agrupadora (ganhou filhos ao ser recuada por outra) não guarda duração
    // própria — o valor dela é sempre a soma dos filhos, calculada na hora de exibir.
    const atividadesValidas = normalizarNiveis(semDescricaoVazia).map((a, i, arr) =>
      temFilhos(arr, i)
        ? { ...a, descricao: a.descricao.trim(), duracao: undefined, unidadeDuracao: undefined }
        : { ...a, descricao: a.descricao.trim() }
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
  const larguraAgrupador = larguraDuracao + LARGURA_ALCA + larguraUnidade;

  return (
    <form onSubmit={salvar} className="flex h-full flex-col space-y-4">
      <FormRow label="Nome do escopo">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Escopo padrão de implantação QRH"
          required
          autoFocus
        />
      </FormRow>

      <div className="flex min-h-0 flex-1 flex-col">
        <p className="mb-1 text-sm font-medium text-brand-navy-2">Atividades</p>
        <p className="mb-1.5 text-[11.5px] text-brand-faint">
          Use as setas de recuo para transformar uma atividade em filha da anterior; as de cima/baixo
          movem entre irmãs. Arraste a divisória entre os títulos para redimensionar as colunas. A
          duração de um agrupador é sempre a soma das atividades dentro dele.
        </p>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-brand-border">
          <div className="w-fit min-w-full">
            <div className="sticky top-0 z-10 flex w-fit items-center border-b border-brand-border bg-brand-hover px-2 py-1.5 text-[10.5px] font-bold tracking-[.06em] text-brand-faint uppercase">
              <span className="w-10 shrink-0" />
              <span className="w-5 shrink-0" />
              <span className="w-9 shrink-0" />
              <span style={{ width: larguraDescricao }} className="shrink-0 px-1">
                Atividade
              </span>
              <AlcaColuna onArrastar={(dx) => redimensionar("descricao", setLarguraDescricao, dx)} />
              <span style={{ width: larguraDuracao }} className="shrink-0 px-1">
                Duração
              </span>
              <AlcaColuna onArrastar={(dx) => redimensionar("duracao", setLarguraDuracao, dx)} />
              <span style={{ width: larguraUnidade }} className="shrink-0 px-1">
                Unidade
              </span>
              <AlcaColuna onArrastar={(dx) => redimensionar("unidade", setLarguraUnidade, dx)} />
              <span className="w-6 shrink-0" />
            </div>

            <div className="w-fit min-w-full space-y-1 p-2">
              {atividades.map((a, i) => (
                <div
                  key={a.id}
                  className="flex w-fit min-w-full items-center gap-0"
                  style={{ paddingLeft: nivelAtividade(a) * 20 }}
                >
                  <span className="w-10 shrink-0 text-right text-[11px] text-brand-faint">{numeracao[i]}</span>
                  <div className="flex w-5 shrink-0 flex-col items-center">
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
                  <div className="flex w-9 shrink-0 justify-center gap-0.5">
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
                  <div style={{ width: larguraDescricao }} className="min-w-0 shrink-0 px-1">
                    <Input
                      value={a.descricao}
                      onChange={(e) => atualizar(a.id, e.target.value)}
                      placeholder="Descrição da atividade"
                    />
                  </div>
                  <div style={{ width: LARGURA_ALCA }} className="shrink-0" />
                  {temFilhos(atividades, i) ? (
                    <span
                      style={{ width: larguraAgrupador }}
                      className="shrink-0 px-1 text-center text-[11px] font-semibold text-brand-navy-2"
                      title="Soma da duração de tudo que está dentro deste agrupador"
                    >
                      {formatarMinutos(somaDuracaoBloco(atividades, i))}
                    </span>
                  ) : (
                    <>
                      <div style={{ width: larguraDuracao }} className="shrink-0 px-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="Duração"
                          value={a.duracao ?? ""}
                          onChange={(e) => atualizarDuracao(a.id, e.target.value)}
                        />
                      </div>
                      <div style={{ width: LARGURA_ALCA }} className="shrink-0" />
                      <div style={{ width: larguraUnidade }} className="shrink-0 px-1">
                        <Select
                          value={a.unidadeDuracao ?? "horas"}
                          onChange={(e) => atualizarUnidade(a.id, e.target.value as UnidadeDuracao)}
                        >
                          <option value="minutos">min</option>
                          <option value="horas">horas</option>
                        </Select>
                      </div>
                    </>
                  )}
                  <div style={{ width: LARGURA_ALCA }} className="shrink-0" />
                  <button
                    type="button"
                    onClick={() => remover(i)}
                    className="w-6 shrink-0 text-brand-faint hover:text-red-600"
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
          </div>
        </div>
        <button
          type="button"
          onClick={adicionar}
          className="mt-2 shrink-0 self-start text-sm font-medium text-brand-accent hover:underline"
        >
          + Adicionar atividade
        </button>
      </div>

      {erro && <p className="shrink-0 text-sm font-medium text-red-600">{erro}</p>}

      <div className="flex shrink-0 justify-end gap-2 pt-2">
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
    <Modal open={open} onClose={onClose} title={escopo ? "Editar escopo" : "Novo escopo"} cheia>
      {open && <EscopoForm key={escopo?.id ?? "novo"} escopo={escopo} onClose={onClose} />}
    </Modal>
  );
}
