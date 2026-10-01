"use client";

import { useMemo, useState } from "react";
import { orderBy } from "firebase/firestore";
import { Archive, Bell, History, RotateCcw, Trash2, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { useCollection } from "@/lib/useCollection";
import {
  atividadesDoContexto,
  faseDaAtividade,
  fasesDoProjeto,
  antecedenciasDe,
  MAX_DIAS_LEMBRETE,
  normalizarTag,
  OPCOES_LEMBRETE,
  rotuloAntecedencia,
  PRIORIDADE_ANOTACAO,
  PRIORIDADES,
  STATUS_ANOTACAO,
} from "@/lib/workspace";
import { arquivarAnotacao, atualizarAnotacao, criarAnotacao, excluirAnotacao, restaurarAnotacao, type NomesContexto } from "@/lib/workspaceDb";
import type { Anotacao, HistoricoAnotacao, PrioridadeAnotacao, Projeto, StatusAnotacao } from "@/types";

const dataHora = (ms: number) => new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * Criar/editar uma anotação pessoal. Projeto, fase e atividade são só referência: escolher a atividade preenche a fase;
 * trocar ou remover o projeto limpa fase e atividade (RN016/RN017). Nada aqui altera o projeto ou o cronograma.
 */
export function AnotacaoModal({
  anotacao,
  usuarioId,
  projetosSelecionaveis,
  todosProjetos,
  nomeProjeto,
  sugestoesTags,
  ordemTopo,
  statusInicial = "a_fazer",
  onClose,
}: {
  /** null = nova anotação. */
  anotacao: Anotacao | null;
  usuarioId: string;
  /** Projetos em que o consultor está alocado (os que ele pode vincular). */
  projetosSelecionaveis: Projeto[];
  /** Todos os projetos (para mostrar o vinculado mesmo que o consultor não esteja mais alocado nele). */
  todosProjetos: Projeto[];
  nomeProjeto: (p: Projeto) => string;
  sugestoesTags: string[];
  /** Posição para ficar no topo da coluna do status. */
  ordemTopo: (status: StatusAnotacao) => number;
  statusInicial?: StatusAnotacao;
  onClose: () => void;
}) {
  const [titulo, setTitulo] = useState(anotacao?.titulo ?? "");
  const [descricao, setDescricao] = useState(anotacao?.descricao ?? "");
  const [status, setStatus] = useState<StatusAnotacao>(anotacao?.status ?? statusInicial);
  const [prioridade, setPrioridade] = useState<PrioridadeAnotacao>(anotacao?.prioridade ?? "normal");
  const [projetoId, setProjetoId] = useState(anotacao?.projetoId ?? "");
  const [faseId, setFaseId] = useState(anotacao?.faseId ?? "");
  const [atividadeId, setAtividadeId] = useState(anotacao?.atividadeId ?? "");
  const [dataLimite, setDataLimite] = useState(anotacao?.dataLimite ?? "");
  // Lembretes no sino de notificações: desligado por padrão; ligado, avisa em cada antecedência escolhida (pode ter várias).
  const antecedenciasIniciais = anotacao ? antecedenciasDe(anotacao) : [];
  const [lembreteAtivo, setLembreteAtivo] = useState(antecedenciasIniciais.length > 0);
  const [antecedencias, setAntecedencias] = useState<number[]>(antecedenciasIniciais.length > 0 ? antecedenciasIniciais : [1]);
  const [outroDias, setOutroDias] = useState("");

  function alternarAntecedencia(dias: number) {
    setAntecedencias((atual) => (atual.includes(dias) ? atual.filter((d) => d !== dias) : [...atual, dias].sort((x, y) => y - x)));
  }
  function adicionarOutro() {
    const dias = Math.round(Number(outroDias));
    if (outroDias.trim() === "" || !Number.isFinite(dias) || dias < 0 || dias > MAX_DIAS_LEMBRETE) return;
    setAntecedencias((atual) => (atual.includes(dias) ? atual : [...atual, dias].sort((x, y) => y - x)));
    setOutroDias("");
  }
  const antecedenciasPersonalizadas = antecedencias.filter((d) => !OPCOES_LEMBRETE.some((o) => o.dias === d));
  const [tags, setTags] = useState<string[]>(anotacao?.tags ?? []);
  const [tagDigitada, setTagDigitada] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [verHistorico, setVerHistorico] = useState(false);
  const [erro, setErro] = useState("");

  const projetoEscolhido = todosProjetos.find((p) => p.id === projetoId);
  const fases = useMemo(() => fasesDoProjeto(projetoEscolhido), [projetoEscolhido]);
  const atividades = useMemo(() => atividadesDoContexto(projetoEscolhido, faseId || null), [projetoEscolhido, faseId]);
  // O projeto vinculado continua na lista mesmo se o consultor não estiver mais alocado nele.
  const opcoesProjeto = useMemo(() => {
    const lista = [...projetosSelecionaveis];
    if (projetoEscolhido && !lista.some((p) => p.id === projetoEscolhido.id)) lista.push(projetoEscolhido);
    return lista.sort((a, b) => nomeProjeto(a).localeCompare(nomeProjeto(b), "pt-BR"));
  }, [projetosSelecionaveis, projetoEscolhido, nomeProjeto]);

  const { data: historico } = useCollection<HistoricoAnotacao>(
    anotacao ? `anotacoes/${anotacao.id}/historico` : "anotacoes",
    [orderBy("criadoEm", "desc")],
    !!anotacao && verHistorico,
    [anotacao?.id, verHistorico]
  );

  function trocarProjeto(id: string) {
    setProjetoId(id);
    // RN016/RN017: sem projeto ou com outro projeto, fase e atividade antigas deixam de valer.
    setFaseId("");
    setAtividadeId("");
  }
  function trocarFase(id: string) {
    setFaseId(id);
    if (atividadeId && !atividadesDoContexto(projetoEscolhido, id || null).some((a) => a.id === atividadeId)) setAtividadeId("");
  }
  function trocarAtividade(id: string) {
    setAtividadeId(id);
    if (id) setFaseId(faseDaAtividade(projetoEscolhido, id) ?? "");
  }

  function adicionarTag(texto: string) {
    const tag = normalizarTag(texto);
    if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase()) && tags.length < 20) setTags([...tags, tag]);
    setTagDigitada("");
  }

  const nomesDe = (pId: string | null | undefined, fId: string | null | undefined, aId: string | null | undefined): NomesContexto => {
    const p = todosProjetos.find((x) => x.id === pId);
    const nomeNoEscopo = (id: string | null | undefined) => (id ? (p?.escopoAtividades?.find((a) => a.id === id)?.descricao ?? null) : null);
    return { projeto: p ? nomeProjeto(p) : null, fase: nomeNoEscopo(fId), atividade: nomeNoEscopo(aId) };
  };

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!titulo.trim()) {
      setErro("Informe o título.");
      return;
    }
    const dados = {
      titulo,
      descricao,
      status,
      prioridade,
      projetoId: projetoId || null,
      faseId: projetoId ? faseId || null : null,
      atividadeId: projetoId ? atividadeId || null : null,
      dataLimite: dataLimite || null,
      lembretesDiasAntes: dataLimite && lembreteAtivo ? antecedencias : [],
      tags,
    };
    setSalvando(true);
    try {
      if (!anotacao) {
        await criarAnotacao(usuarioId, dados, ordemTopo(status));
      } else {
        const mudouColuna = status !== anotacao.status;
        await atualizarAnotacao(anotacao, mudouColuna ? { ...dados, ordem: ordemTopo(status) } : dados, {
          antes: nomesDe(anotacao.projetoId, anotacao.faseId, anotacao.atividadeId),
          depois: nomesDe(dados.projetoId, dados.faseId, dados.atividadeId),
        });
      }
      onClose();
    } catch (err) {
      console.error("Erro ao salvar a anotação:", err);
      setErro("Não foi possível salvar. Confira se as regras do Firestore foram publicadas e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function executar(fn: () => Promise<void>) {
    setSalvando(true);
    setErro("");
    try {
      await fn();
      onClose();
    } catch (err) {
      console.error("Erro na anotação:", err);
      setErro(err instanceof Error && err.message.startsWith("Só") ? err.message : "Não foi possível concluir. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const arquivada = anotacao?.status === "arquivado";
  // Status escolhíveis no formulário: arquivar é uma ação à parte (só para concluída).
  const opcoesStatus: StatusAnotacao[] = arquivada ? ["arquivado"] : ["a_fazer", "em_andamento", "concluido"];

  return (
    <Modal open onClose={onClose} title={anotacao ? "Anotação" : "Nova anotação"} wide>
      <form onSubmit={salvar} className="space-y-4">
        <FormRow label="Título">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} placeholder="Ex.: Verificar erro de integração do TAF" autoFocus required />
        </FormRow>
        <FormRow label="Descrição (opcional)">
          <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={5000} />
        </FormRow>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormRow label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as StatusAnotacao)} disabled={arquivada}>
              {opcoesStatus.map((s) => (
                <option key={s} value={s}>
                  {STATUS_ANOTACAO[s].label}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="Prioridade">
            <div className="grid grid-cols-3 gap-1.5">
              {PRIORIDADES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrioridade(p)}
                  aria-pressed={prioridade === p}
                  className={`h-10 rounded-[10px] border text-[12.5px] font-bold transition-colors ${
                    prioridade === p ? "border-transparent" : "border-brand-border bg-white text-brand-muted hover:bg-brand-hover"
                  }`}
                  style={prioridade === p ? { backgroundColor: PRIORIDADE_ANOTACAO[p].bg, color: PRIORIDADE_ANOTACAO[p].cor } : undefined}
                >
                  {PRIORIDADE_ANOTACAO[p].label}
                </button>
              ))}
            </div>
          </FormRow>
          <FormRow label="Data limite (opcional)">
            <Input type="date" value={dataLimite} onChange={(e) => setDataLimite(e.target.value)} />
          </FormRow>
        </div>

        <div className="space-y-3 rounded-xl border border-brand-border bg-brand-hover/50 p-3.5">
          <p className="text-[12px] text-brand-muted">
            Vínculo opcional, só para contexto: a anotação continua <strong>privada</strong> e não altera o projeto, a atividade nem o cronograma.
          </p>
          <FormRow label="Projeto">
            <Select value={projetoId} onChange={(e) => trocarProjeto(e.target.value)}>
              <option value="">Sem projeto</option>
              {opcoesProjeto.map((p) => (
                <option key={p.id} value={p.id}>
                  {nomeProjeto(p)}
                </option>
              ))}
            </Select>
          </FormRow>
          {projetoId && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormRow label="Fase (opcional)">
                <Select value={faseId} onChange={(e) => trocarFase(e.target.value)} disabled={fases.length === 0}>
                  <option value="">{fases.length === 0 ? "Projeto sem cronograma" : "Sem fase"}</option>
                  {fases.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.descricao}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <FormRow label="Atividade (opcional)">
                <Select value={atividadeId} onChange={(e) => trocarAtividade(e.target.value)} disabled={atividades.length === 0}>
                  <option value="">{atividades.length === 0 ? "Sem atividades" : "Sem atividade"}</option>
                  {atividades.map((a) => (
                    <option key={a.id} value={a.id} title={a.caminho}>
                      {faseId ? a.descricao : `${a.caminho ? `${a.caminho} › ` : ""}${a.descricao}`}
                    </option>
                  ))}
                </Select>
              </FormRow>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-brand-border p-3.5">
          <label className={`flex items-center gap-2.5 ${dataLimite ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
            <button
              type="button"
              role="switch"
              aria-checked={lembreteAtivo && !!dataLimite}
              disabled={!dataLimite}
              onClick={() => setLembreteAtivo((v) => !v)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${lembreteAtivo && dataLimite ? "bg-brand-accent" : "bg-[#cfd5e2]"}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${lembreteAtivo && dataLimite ? "left-[18px]" : "left-0.5"}`}
              />
            </button>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-navy-2">
              <Bell size={14} className="text-brand-faint" />
              Me lembrar nas notificações
            </span>
            {!dataLimite && <span className="text-[11.5px] text-brand-faint">— defina a data limite para ligar</span>}
          </label>
          {lembreteAtivo && dataLimite && (
            <div className="mt-3 space-y-2">
              <p className="text-[11.5px] text-brand-faint">Escolha um ou mais avisos — cada um volta a aparecer como não lido no sino.</p>
              <div className="flex flex-wrap items-center gap-2">
                {OPCOES_LEMBRETE.map((o) => {
                  const ativo = antecedencias.includes(o.dias);
                  return (
                    <button
                      key={o.dias}
                      type="button"
                      onClick={() => alternarAntecedencia(o.dias)}
                      aria-pressed={ativo}
                      className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors ${
                        ativo ? "border-brand-accent bg-brand-accent-soft text-brand-accent" : "border-brand-border bg-white text-brand-muted hover:bg-brand-hover"
                      }`}
                    >
                      {ativo ? "✓ " : ""}
                      {o.label}
                    </button>
                  );
                })}
                {antecedenciasPersonalizadas.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 rounded-full border border-brand-accent bg-brand-accent-soft px-3 py-1 text-[12.5px] font-semibold text-brand-accent">
                    ✓ {rotuloAntecedencia(d)}
                    <button type="button" onClick={() => alternarAntecedencia(d)} aria-label={`Remover ${rotuloAntecedencia(d)}`} className="hover:text-red-600">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[12.5px] text-brand-muted">
                Outro:
                <Input
                  type="number"
                  min={0}
                  max={MAX_DIAS_LEMBRETE}
                  value={outroDias}
                  onChange={(e) => setOutroDias(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarOutro();
                    }
                  }}
                  placeholder="nº"
                  className="w-20"
                />
                dias antes
                <Button type="button" variant="secondary" onClick={adicionarOutro} className="h-8 px-3 text-[12px]">
                  Adicionar
                </Button>
              </div>
              {antecedencias.length === 0 && <p className="text-[11.5px] font-semibold text-[#a4650d]">Nenhum aviso escolhido: o lembrete fica desligado.</p>}
            </div>
          )}
        </div>

        <FormRow label="Tags (opcional)">
          <div className="flex flex-wrap items-center gap-1.5 rounded-[10px] border border-brand-border bg-white px-2 py-1.5">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-accent-soft px-2 py-0.5 text-[12px] font-semibold text-brand-accent">
                #{t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remover #${t}`} className="hover:text-red-600">
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              value={tagDigitada}
              onChange={(e) => setTagDigitada(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  adicionarTag(tagDigitada);
                } else if (e.key === "Backspace" && !tagDigitada && tags.length > 0) {
                  setTags(tags.slice(0, -1));
                }
              }}
              onBlur={() => tagDigitada && adicionarTag(tagDigitada)}
              list="sugestoes-tags-workspace"
              placeholder={tags.length === 0 ? "Digite e tecle Enter (ex.: eSocial, Cliente)" : ""}
              className="min-w-[160px] flex-1 border-0 bg-transparent py-1 text-[13.5px] text-brand-navy-2 outline-none"
            />
            <datalist id="sugestoes-tags-workspace">
              {sugestoesTags
                .filter((t) => !tags.includes(t))
                .map((t) => (
                  <option key={t} value={t} />
                ))}
            </datalist>
          </div>
        </FormRow>

        {anotacao?.dataConclusao && (anotacao.status === "concluido" || arquivada) && (
          <p className="text-[12px] text-[#15754c]">Concluída em {dataHora(anotacao.dataConclusao)}.</p>
        )}
        {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

        {anotacao && (
          <div className="flex flex-wrap items-center gap-2 border-t border-brand-border-soft pt-3">
            {!arquivada && (
              <Button type="button" variant="secondary" disabled={salvando} onClick={() => executar(() => arquivarAnotacao(anotacao))}>
                <Archive size={15} />
                Arquivar
              </Button>
            )}
            {arquivada && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={salvando}
                  onClick={() => executar(() => restaurarAnotacao(anotacao, "a_fazer", ordemTopo("a_fazer")))}
                >
                  <RotateCcw size={15} />
                  Voltar para A fazer
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={salvando}
                  onClick={() => executar(() => restaurarAnotacao(anotacao, "em_andamento", ordemTopo("em_andamento")))}
                >
                  <RotateCcw size={15} />
                  Voltar para Em andamento
                </Button>
              </>
            )}
            <button type="button" onClick={() => setVerHistorico((v) => !v)} className="ml-auto flex items-center gap-1 text-[12.5px] font-semibold text-brand-accent hover:underline">
              <History size={14} />
              {verHistorico ? "Ocultar histórico" : "Ver histórico"}
            </button>
          </div>
        )}
        {anotacao && verHistorico && (
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-brand-border bg-white p-3 text-[12.5px]">
            {historico.length === 0 && <li className="text-brand-faint">Carregando…</li>}
            {historico.map((h) => (
              <li key={h.id} className="flex gap-3">
                <span className="shrink-0 text-brand-faint">{dataHora(h.criadoEm)}</span>
                <span className="text-brand-navy-2">
                  {h.acao}
                  {h.valorAnterior || h.valorNovo ? (
                    <span className="text-brand-muted">
                      {" "}
                      ({h.valorAnterior ?? "—"} → {h.valorNovo ?? "—"})
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <div>
            {anotacao &&
              (confirmandoExclusao ? (
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium text-red-600">Mover para a lixeira? (fica 15 dias)</span>
                  <Button type="button" variant="danger" disabled={salvando} onClick={() => executar(() => excluirAnotacao(anotacao))}>
                    Sim, excluir
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setConfirmandoExclusao(false)}>
                    Não
                  </Button>
                </span>
              ) : (
                <Button type="button" variant="ghost" onClick={() => setConfirmandoExclusao(true)} className="text-red-600">
                  <Trash2 size={15} />
                  Excluir
                </Button>
              ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
