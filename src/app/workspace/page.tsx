"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { where } from "firebase/firestore";
import { Archive, Bell, CalendarClock, FolderKanban, LayoutGrid, List, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { AnotacaoModal } from "@/components/workspace/AnotacaoModal";
import { ListaAnotacoes } from "@/components/workspace/ListaAnotacoes";
import { LixeiraModal } from "@/components/workspace/LixeiraModal";
import { useAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { nomeExibicaoCliente } from "@/lib/cliente";
import {
  ATALHOS,
  COLUNAS_KANBAN,
  contextoDaAnotacao,
  estaAtrasada,
  FILTROS_VAZIOS,
  filtrarAnotacoes,
  ordemAoSoltar,
  porOrdem,
  PRIORIDADE_ANOTACAO,
  PRIORIDADES,
  resumoPorProjeto,
  STATUS_ANOTACAO,
  antecedenciasDe,
  venceuNaLixeira,
  type FiltrosWorkspace,
} from "@/lib/workspace";
import { arquivarAnotacao, criarAnotacao, excluirDefinitivamente, moverAnotacao } from "@/lib/workspaceDb";
import type { Anotacao, Cliente, PrioridadeAnotacao, Projeto, StatusAnotacao } from "@/types";

const dataCurta = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

function CartaoAnotacao({
  a,
  contexto,
  atrasada,
  onAbrir,
  onArquivar,
  onArrastar,
}: {
  a: Anotacao;
  contexto: { projeto: string | null; fase: string | null; atividade: string | null };
  atrasada: boolean;
  onAbrir: () => void;
  onArquivar?: () => void;
  onArrastar?: (e: React.DragEvent) => void;
}) {
  const prio = PRIORIDADE_ANOTACAO[a.prioridade];
  return (
    <div
      draggable={!!onArrastar}
      onDragStart={onArrastar}
      onClick={onAbrir}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onAbrir()}
      className={`cursor-pointer rounded-xl border bg-white p-3 shadow-[0_2px_8px_rgba(21,40,73,0.06)] transition-shadow hover:shadow-[0_6px_16px_rgba(21,40,73,0.1)] ${
        atrasada ? "border-[#f3b8b0]" : "border-brand-border"
      }`}
    >
      <p className={`text-[13.5px] leading-snug font-bold ${a.status === "concluido" || a.status === "arquivado" ? "text-brand-muted" : "text-brand-navy-2"}`}>
        {a.titulo}
      </p>
      {contexto.projeto && (
        <p className="mt-1 truncate text-[11.5px] text-brand-muted" title={[contexto.projeto, contexto.fase, contexto.atividade].filter(Boolean).join(" › ")}>
          <FolderKanban size={11} className="mr-1 -mt-0.5 inline" />
          {contexto.projeto}
          {contexto.atividade ? ` › ${contexto.atividade}` : contexto.fase ? ` › ${contexto.fase}` : ""}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {a.prioridade !== "normal" && (
          <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: prio.bg, color: prio.cor }}>
            {prio.label}
          </span>
        )}
        {a.dataLimite && (
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
              atrasada ? "bg-[#fdeceb] text-[#b5392a]" : "bg-brand-hover text-brand-muted"
            }`}
            title={`${atrasada ? "Atrasada" : "Data limite"}${antecedenciasDe(a).length > 0 ? " · com lembrete nas notificações" : ""}`}
          >
            <CalendarClock size={11} />
            {atrasada ? `Atrasada · ${dataCurta(a.dataLimite)}` : dataCurta(a.dataLimite)}
            {antecedenciasDe(a).length > 0 && <Bell size={10} />}
          </span>
        )}
        {(a.tags ?? []).slice(0, 3).map((t) => (
          <span key={t} className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-brand-accent">
            #{t}
          </span>
        ))}
        {(a.tags ?? []).length > 3 && <span className="text-[10.5px] text-brand-faint">+{(a.tags ?? []).length - 3}</span>}
        {onArquivar && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onArquivar();
            }}
            className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-brand-faint hover:bg-brand-hover hover:text-brand-navy-2"
            title="Arquivar"
          >
            <Archive size={12} />
            Arquivar
          </button>
        )}
      </div>
    </div>
  );
}

function WorkspaceContent() {
  const { usuario } = useAuth();
  const uid = usuario?.uid ?? "";
  // A consulta já vem só com as anotações do consultor logado (as regras do Firestore também exigem isso).
  const { data: todas, loading, erro } = useCollection<Anotacao>("anotacoes", [where("usuarioId", "==", uid)], !!uid, [uid]);
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");

  const [filtros, setFiltros] = useState<FiltrosWorkspace>(FILTROS_VAZIOS);
  const [visao, setVisao] = useState<"kanban" | "lista" | "projetos">("kanban");
  const [lixeiraAberta, setLixeiraAberta] = useState(false);
  const [editando, setEditando] = useState<Anotacao | null | "nova">(null);
  const [rapida, setRapida] = useState("");
  const [salvandoRapida, setSalvandoRapida] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<StatusAnotacao | null>(null);
  const [erroAcao, setErroAcao] = useState("");
  // Vindo de um lembrete do sino (?anotacao=id): abre a anotação direto, uma vez.
  const router = useRouter();
  const idDaUrl = useSearchParams().get("anotacao");
  const [idDaUrlFechado, setIdDaUrlFechado] = useState<string | null>(null);

  const hojeIso = new Date().toLocaleDateString("sv-SE");
  const ativas = useMemo(() => todas.filter((a) => !a.deletedAt), [todas]);
  const naLixeira = useMemo(() => todas.filter((a) => !!a.deletedAt), [todas]);

  // Lixeira: o que passou do prazo é apagado de vez ao abrir o Workspace (uma vez por anotação).
  const apagando = useRef(new Set<string>());
  useEffect(() => {
    const agora = Date.now();
    const vencidas = naLixeira.filter((a) => a.deletedAt && venceuNaLixeira(a.deletedAt, agora) && !apagando.current.has(a.id));
    if (vencidas.length === 0) return;
    vencidas.forEach((a) => apagando.current.add(a.id));
    (async () => {
      for (const a of vencidas) {
        try {
          await excluirDefinitivamente(a);
        } catch (err) {
          console.warn("Não foi possível esvaziar um item vencido da lixeira:", err);
        }
      }
    })();
  }, [naLixeira]);

  const nomeProjeto = useMemo(() => {
    const porCliente = new Map(clientes.map((c) => [c.id, nomeExibicaoCliente(c)]));
    return (p: Projeto) => `${porCliente.get(p.clienteId) ?? "Cliente"} — ${p.codigoProposta}`;
  }, [clientes]);
  const meuRecursoId = usuario?.recursoId ?? null;
  const meusProjetos = useMemo(
    () => (meuRecursoId ? projetos.filter((p) => (p.consultorIds ?? []).includes(meuRecursoId)) : []),
    [projetos, meuRecursoId]
  );
  const contextoDe = (a: Anotacao) => contextoDaAnotacao(a, projetos, nomeProjeto);
  const textoContexto = (a: Anotacao) => Object.values(contextoDe(a)).filter(Boolean).join(" ");

  const filtradas = filtrarAnotacoes(ativas, filtros, hojeIso, textoContexto);
  const sugestoesTags = useMemo(() => [...new Set(ativas.flatMap((a) => a.tags ?? []))].sort((a, b) => a.localeCompare(b, "pt-BR")), [ativas]);
  const projetosComAnotacao = useMemo(() => {
    const ids = new Set(ativas.map((a) => a.projetoId).filter(Boolean) as string[]);
    return projetos.filter((p) => ids.has(p.id)).sort((a, b) => nomeProjeto(a).localeCompare(nomeProjeto(b), "pt-BR"));
  }, [ativas, projetos, nomeProjeto]);

  const anotacaoDaUrl = idDaUrl && idDaUrl !== idDaUrlFechado ? (ativas.find((a) => a.id === idDaUrl) ?? null) : null;
  const emEdicao = editando ?? anotacaoDaUrl;
  function fecharEdicao() {
    setEditando(null);
    if (anotacaoDaUrl && idDaUrl) {
      setIdDaUrlFechado(idDaUrl);
      router.replace("/workspace");
    }
  }

  const atrasadas = ativas.filter((a) => estaAtrasada(a, hojeIso)).length;
  const pendentes = ativas.filter((a) => a.status === "a_fazer" || a.status === "em_andamento").length;
  const concluidas = ativas.filter((a) => a.status === "concluido").length;

  /** Posição para ficar no topo da coluna. */
  const ordemTopo = (status: StatusAnotacao) => {
    const daColuna = ativas.filter((a) => a.status === status);
    return daColuna.length === 0 ? 0 : Math.min(...daColuna.map((a) => a.ordem)) - 1;
  };

  async function criarRapida(e: React.FormEvent) {
    e.preventDefault();
    if (!rapida.trim() || !uid) return;
    setSalvandoRapida(true);
    setErroAcao("");
    try {
      await criarAnotacao(uid, { titulo: rapida }, ordemTopo("a_fazer"));
      setRapida("");
    } catch (err) {
      console.error("Erro ao criar anotação:", err);
      setErroAcao("Não foi possível salvar a anotação. Confira se as regras do Firestore foram publicadas.");
    } finally {
      setSalvandoRapida(false);
    }
  }

  async function soltar(status: StatusAnotacao, alvoId: string | null) {
    const movida = ativas.find((a) => a.id === arrastando);
    setArrastando(null);
    setColunaAlvo(null);
    if (!movida || movida.id === alvoId) return;
    const coluna = ativas.filter((a) => a.status === status);
    try {
      await moverAnotacao(movida, status, ordemAoSoltar(coluna, movida.id, alvoId));
    } catch (err) {
      console.error("Erro ao mover anotação:", err);
      setErroAcao("Não foi possível mover a anotação. Tente de novo.");
    }
  }

  const alterarFiltro = <K extends keyof FiltrosWorkspace>(k: K, v: FiltrosWorkspace[K]) => setFiltros((f) => ({ ...f, [k]: v }));
  const temFiltro = JSON.stringify(filtros) !== JSON.stringify(FILTROS_VAZIOS);
  const verArquivadas = filtros.atalho === "arquivado";

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">
          <StickyNote size={20} className="text-brand-accent" />
          Meu Workspace
        </h1>
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setLixeiraAberta(true)}
          aria-label={`Lixeira (${naLixeira.length})`}
          title="Lixeira — anotações excluídas ficam 15 dias e depois são apagadas"
          className="relative flex h-10 w-10 items-center justify-center rounded-[10px] border border-brand-border bg-white text-brand-muted transition-colors hover:bg-brand-hover"
        >
          <Trash2 size={17} />
          {naLixeira.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-navy-2 px-1 text-[10px] font-bold text-white">
              {naLixeira.length}
            </span>
          )}
        </button>
        <Button onClick={() => setEditando("nova")}>
          <Plus size={16} />
          Nova anotação
        </Button>
        </div>
      </div>
      <p className="mb-4 text-sm text-brand-muted">
        Suas anotações pessoais — lembretes, pendências e observações. <strong>Só você vê</strong>: nem o administrador nem os colegas do projeto têm acesso,
        e vincular a um projeto não muda isso nem altera o projeto.
      </p>

      {/* Resumo */}
      <div className="mb-4 flex flex-wrap gap-2.5 text-[13px]">
        <button type="button" onClick={() => alterarFiltro("atalho", "atrasadas")} className="rounded-xl border border-[#f3b8b0] bg-[#fdeceb] px-3.5 py-2 font-bold text-[#b5392a] hover:brightness-95">
          {atrasadas} atrasada{atrasadas === 1 ? "" : "s"}
        </button>
        <button type="button" onClick={() => alterarFiltro("atalho", "todas")} className="rounded-xl border border-[#f3dcb8] bg-[#fff2de] px-3.5 py-2 font-bold text-[#a4650d] hover:brightness-95">
          {pendentes} pendente{pendentes === 1 ? "" : "s"}
        </button>
        <button type="button" onClick={() => alterarFiltro("atalho", "concluido")} className="rounded-xl border border-[#b9e2cb] bg-[#e3f5ea] px-3.5 py-2 font-bold text-[#15754c] hover:brightness-95">
          {concluidas} concluída{concluidas === 1 ? "" : "s"}
        </button>
      </div>

      {/* Criação rápida */}
      <form onSubmit={criarRapida} className="mb-4 flex gap-2">
        <div className="min-w-0 flex-1">
          <Input value={rapida} onChange={(e) => setRapida(e.target.value)} maxLength={200} placeholder="Anotar algo rápido… ex.: Verificar erro de integração do TAF (Enter para salvar)" />
        </div>
        <Button type="submit" variant="secondary" disabled={!rapida.trim() || salvandoRapida}>
          {salvandoRapida ? "Salvando..." : "Anotar"}
        </Button>
      </form>
      {(erroAcao || erro) && (
        <p className="mb-3 rounded-md bg-[#fdeceb] p-3 text-[13px] text-[#b5392a]">{erroAcao || "Não foi possível carregar suas anotações. Confira se as regras do Firestore foram publicadas."}</p>
      )}

      {/* Busca, atalhos e filtros */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-72 max-w-full">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-brand-faint" />
          <Input value={filtros.busca} onChange={(e) => alterarFiltro("busca", e.target.value)} placeholder="Buscar em título, descrição, projeto, tags…" className="pl-9" />
        </div>
        <div className="w-56">
          <Select value={filtros.projetoId} onChange={(e) => alterarFiltro("projetoId", e.target.value)} aria-label="Projeto">
            <option value="">Todos os projetos</option>
            <option value="sem">Sem projeto</option>
            {projetosComAnotacao.map((p) => (
              <option key={p.id} value={p.id}>
                {nomeProjeto(p)}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Select value={filtros.prioridade} onChange={(e) => alterarFiltro("prioridade", e.target.value as "" | PrioridadeAnotacao)} aria-label="Prioridade">
            <option value="">Toda prioridade</option>
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {PRIORIDADE_ANOTACAO[p].label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Select value={filtros.tag} onChange={(e) => alterarFiltro("tag", e.target.value)} aria-label="Tag">
            <option value="">Todas as tags</option>
            {sugestoesTags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-1.5 text-[12.5px] text-brand-muted">
          Prazo até
          <Input type="date" value={filtros.prazoAte} onChange={(e) => alterarFiltro("prazoAte", e.target.value)} className="w-40" />
        </label>
        {temFiltro && (
          <button type="button" onClick={() => setFiltros(FILTROS_VAZIOS)} className="text-[12.5px] font-semibold text-brand-accent hover:underline">
            Limpar filtros
          </button>
        )}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {ATALHOS.map((at) => {
          const ativo = filtros.atalho === at.id;
          return (
            <button
              key={at.id}
              type="button"
              onClick={() => alterarFiltro("atalho", at.id)}
              aria-pressed={ativo}
              className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors ${
                ativo ? "border-brand-accent bg-brand-accent-soft text-brand-accent" : "border-brand-border bg-white text-brand-muted hover:bg-brand-hover"
              }`}
            >
              {at.label}
            </button>
          );
        })}
        <div className="ml-auto flex overflow-hidden rounded-[10px] border border-brand-border bg-white">
          <button
            type="button"
            onClick={() => setVisao("kanban")}
            aria-pressed={visao === "kanban"}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold ${visao === "kanban" ? "bg-brand-accent-soft text-brand-accent" : "text-brand-muted hover:bg-brand-hover"}`}
          >
            <LayoutGrid size={14} />
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setVisao("lista")}
            aria-pressed={visao === "lista"}
            className={`flex items-center gap-1.5 border-l border-brand-border px-3 py-1.5 text-[12.5px] font-semibold ${visao === "lista" ? "bg-brand-accent-soft text-brand-accent" : "text-brand-muted hover:bg-brand-hover"}`}
          >
            <List size={14} />
            Lista
          </button>
          <button
            type="button"
            onClick={() => setVisao("projetos")}
            aria-pressed={visao === "projetos"}
            className={`flex items-center gap-1.5 border-l border-brand-border px-3 py-1.5 text-[12.5px] font-semibold ${visao === "projetos" ? "bg-brand-accent-soft text-brand-accent" : "text-brand-muted hover:bg-brand-hover"}`}
          >
            <FolderKanban size={14} />
            Meus projetos
          </button>
        </div>
      </div>

      {visao === "lista" ? (
        <ListaAnotacoes anotacoes={filtradas} contextoDe={contextoDe} atrasada={(a) => estaAtrasada(a, hojeIso)} onAbrir={(a) => setEditando(a)} />
      ) : visao === "projetos" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {resumoPorProjeto(ativas)
            .sort((a, b) => b.total - a.total)
            .map((r) => {
              const projeto = r.projetoId ? projetos.find((p) => p.id === r.projetoId) : undefined;
              const nome = r.projetoId ? (projeto ? nomeProjeto(projeto) : "Projeto removido") : "Sem projeto";
              return (
                <button
                  key={r.projetoId ?? "sem"}
                  type="button"
                  onClick={() => {
                    setFiltros({ ...FILTROS_VAZIOS, projetoId: r.projetoId ?? "sem" });
                    setVisao("kanban");
                  }}
                  className="rounded-2xl border border-brand-border bg-white p-4 text-left shadow-card hover:bg-brand-hover/60"
                >
                  <p className="truncate text-[14px] font-extrabold text-brand-navy-2">{nome}</p>
                  <p className="mb-2 text-[12px] text-brand-muted">
                    {r.total} anotaç{r.total === 1 ? "ão" : "ões"}
                  </p>
                  <ul className="space-y-0.5 text-[12.5px]">
                    {(Object.keys(STATUS_ANOTACAO) as StatusAnotacao[])
                      .filter((s) => r.porStatus[s] > 0)
                      .map((s) => (
                        <li key={s} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_ANOTACAO[s].cor }} />
                          <span className="text-brand-navy-2">
                            {r.porStatus[s]} {STATUS_ANOTACAO[s].label.toLowerCase()}
                          </span>
                        </li>
                      ))}
                  </ul>
                </button>
              );
            })}
          {!loading && ativas.length === 0 && <p className="text-[13px] text-brand-faint">Nenhuma anotação ainda.</p>}
        </div>
      ) : verArquivadas ? (
        <div className="rounded-2xl border border-brand-border bg-brand-hover/40 p-4">
          <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-brand-navy-2">
            <Archive size={15} className="text-brand-faint" />
            Arquivadas ({filtradas.length})
          </p>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {[...filtradas].sort((a, b) => b.updatedAt - a.updatedAt).map((a) => (
              <CartaoAnotacao key={a.id} a={a} contexto={contextoDe(a)} atrasada={false} onAbrir={() => setEditando(a)} />
            ))}
          </div>
          {filtradas.length === 0 && <p className="text-[13px] text-brand-faint">Nenhuma anotação arquivada.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {COLUNAS_KANBAN.map((status) => {
            const cfg = STATUS_ANOTACAO[status];
            const cartoes = filtradas.filter((a) => a.status === status).sort(porOrdem);
            const alvo = colunaAlvo === status && !!arrastando;
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setColunaAlvo(status);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setColunaAlvo(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void soltar(status, null);
                }}
                className={`flex min-h-[320px] flex-col rounded-2xl border p-3 transition-colors ${alvo ? "border-brand-accent bg-brand-accent-soft/40" : "border-brand-border bg-brand-hover/40"}`}
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="flex items-center gap-2 text-[11.5px] font-bold tracking-[.08em] uppercase" style={{ color: cfg.cor }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.cor }} />
                    {cfg.label}
                  </p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-brand-muted">{cartoes.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {cartoes.map((a) => (
                    <div
                      key={a.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void soltar(status, a.id);
                      }}
                      className={arrastando === a.id ? "opacity-40" : ""}
                    >
                      <CartaoAnotacao
                        a={a}
                        contexto={contextoDe(a)}
                        atrasada={estaAtrasada(a, hojeIso)}
                        onAbrir={() => setEditando(a)}
                        onArquivar={status === "concluido" ? () => void arquivarAnotacao(a).catch(() => setErroAcao("Não foi possível arquivar. Tente de novo.")) : undefined}
                        onArrastar={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", a.id);
                          setArrastando(a.id);
                        }}
                      />
                    </div>
                  ))}
                  {cartoes.length === 0 && (
                    <p className="rounded-xl border border-dashed border-brand-border p-4 text-center text-[12px] text-brand-faint">
                      {loading ? "Carregando…" : arrastando ? "Solte aqui" : "Nada por aqui"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lixeiraAberta && <LixeiraModal itens={naLixeira} contextoProjeto={(a) => contextoDe(a).projeto} onClose={() => setLixeiraAberta(false)} />}

      {emEdicao && usuario && (
        <AnotacaoModal
          key={emEdicao === "nova" ? "nova" : emEdicao.id}
          anotacao={emEdicao === "nova" ? null : emEdicao}
          usuarioId={uid}
          projetosSelecionaveis={meusProjetos}
          todosProjetos={projetos}
          nomeProjeto={nomeProjeto}
          sugestoesTags={sugestoesTags}
          ordemTopo={ordemTopo}
          onClose={fecharEdicao}
        />
      )}
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <ProtectedPage perfis={["consultor"]}>
      {/* useSearchParams (abrir a anotação vinda de um lembrete) pede um limite de Suspense. */}
      <Suspense fallback={<p className="text-sm text-brand-faint">Carregando…</p>}>
        <WorkspaceContent />
      </Suspense>
    </ProtectedPage>
  );
}
