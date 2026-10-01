"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { where } from "firebase/firestore";
import {
  AlertCircle,
  Archive,
  CalendarDays,
  FolderKanban,
  LayoutGrid,
  List,
  Lock,
  Plus,
  Search,
  SlidersHorizontal,
  StickyNote,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { AnotacaoModal } from "@/components/workspace/AnotacaoModal";
import { ListaAnotacoes } from "@/components/workspace/ListaAnotacoes";
import { LixeiraModal } from "@/components/workspace/LixeiraModal";
import { CartaoAnotacao } from "@/components/workspace/CartaoAnotacao";
import { ICONE_STATUS } from "@/components/workspace/visual";
import { useAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { nomeExibicaoCliente } from "@/lib/cliente";
import {
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
  venceuNaLixeira,
  type AtalhoWorkspace,
  type FiltrosWorkspace,
} from "@/lib/workspace";
import { arquivarAnotacao, criarAnotacao, excluirDefinitivamente, moverAnotacao } from "@/lib/workspaceDb";
import type { Anotacao, Cliente, PrioridadeAnotacao, Projeto, StatusAnotacao } from "@/types";

type Visao = "kanban" | "lista" | "projetos";
const VISOES: { id: Visao; label: string; icone: LucideIcon }[] = [
  { id: "kanban", label: "Quadro", icone: LayoutGrid },
  { id: "lista", label: "Lista", icone: List },
  { id: "projetos", label: "Por projeto", icone: FolderKanban },
];

/** Atalhos de prazo: cada um com a sua cor (vermelho = atrasado, âmbar = hoje). */
const ATALHOS_PRAZO: { id: AtalhoWorkspace; label: string; icone: LucideIcon; ativo: string }[] = [
  { id: "atrasadas", label: "Atrasadas", icone: AlertCircle, ativo: "border-[#f3b8b0] bg-[#fdeceb] text-[#b5392a]" },
  { id: "hoje", label: "Vencem hoje", icone: CalendarDays, ativo: "border-[#f3dcb8] bg-[#fff2de] text-[#a4650d]" },
  { id: "arquivado", label: "Arquivadas", icone: Archive, ativo: "border-brand-accent bg-brand-accent-soft text-brand-accent" },
];

const BOTAO_ICONE = "relative flex h-10 w-10 items-center justify-center rounded-[10px] border transition-colors";
const BOTAO_ICONE_INATIVO = "border-brand-border bg-white text-brand-muted hover:bg-brand-hover";
const BOTAO_ICONE_ATIVO = "border-brand-accent bg-brand-accent-soft text-brand-accent";

function WorkspaceContent() {
  const { usuario } = useAuth();
  const uid = usuario?.uid ?? "";
  // A consulta já vem só com as anotações do consultor logado (as regras do Firestore também exigem isso).
  const { data: todas, loading, erro } = useCollection<Anotacao>("anotacoes", [where("usuarioId", "==", uid)], !!uid, [uid]);
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");

  const [filtros, setFiltros] = useState<FiltrosWorkspace>(FILTROS_VAZIOS);
  const [visao, setVisao] = useState<Visao>("kanban");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
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

  const contagemAtalho: Record<string, number> = {
    atrasadas: ativas.filter((a) => estaAtrasada(a, hojeIso)).length,
    hoje: ativas.filter((a) => a.dataLimite === hojeIso && a.status !== "concluido" && a.status !== "arquivado").length,
    arquivado: ativas.filter((a) => a.status === "arquivado").length,
  };

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

  const concluir = (a: Anotacao) =>
    void moverAnotacao(a, "concluido", ordemTopo("concluido")).catch(() => setErroAcao("Não foi possível concluir. Tente de novo."));
  const arquivar = (a: Anotacao) => void arquivarAnotacao(a).catch(() => setErroAcao("Não foi possível arquivar. Tente de novo."));

  const alterarFiltro = <K extends keyof FiltrosWorkspace>(k: K, v: FiltrosWorkspace[K]) => setFiltros((f) => ({ ...f, [k]: v }));
  const alternarAtalho = (id: AtalhoWorkspace) => alterarFiltro("atalho", filtros.atalho === id ? "todas" : id);
  const filtrosExtras = [filtros.projetoId, filtros.prioridade, filtros.tag, filtros.prazoAte].filter(Boolean).length;
  const temFiltro = JSON.stringify(filtros) !== JSON.stringify(FILTROS_VAZIOS);
  const verArquivadas = filtros.atalho === "arquivado";

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">
            <StickyNote size={20} className="text-brand-accent" />
            Meu Workspace
          </h1>
          <p
            className="mt-0.5 flex items-center gap-1 text-[12.5px] text-brand-muted"
            title="Nem o administrador nem os colegas têm acesso. Vincular a um projeto não muda isso nem altera o projeto."
          >
            <Lock size={12} />
            Anotações privadas — só você vê
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLixeiraAberta(true)}
            aria-label={`Lixeira (${naLixeira.length})`}
            title="Lixeira — o que você exclui fica 15 dias aqui"
            className={`${BOTAO_ICONE} ${BOTAO_ICONE_INATIVO}`}
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

      {/* Barra: visões, busca, atalhos e filtros */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-[10px] border border-brand-border bg-white">
          {VISOES.map((v, i) => {
            const Icone = v.icone;
            const ativa = visao === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setVisao(v.id)}
                aria-pressed={ativa}
                className={`flex h-10 items-center gap-1.5 px-3.5 text-[13px] font-semibold transition-colors ${i > 0 ? "border-l border-brand-border" : ""} ${
                  ativa ? "bg-brand-accent-soft text-brand-accent" : "text-brand-muted hover:bg-brand-hover"
                }`}
              >
                <Icone size={15} />
                {v.label}
              </button>
            );
          })}
        </div>
        <div className="relative w-64 max-w-full">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-brand-faint" />
          <Input value={filtros.busca} onChange={(e) => alterarFiltro("busca", e.target.value)} placeholder="Buscar…" className="pl-9" />
        </div>
        <button
          type="button"
          onClick={() => setFiltrosAbertos((v) => !v)}
          aria-pressed={filtrosAbertos}
          aria-label="Filtros"
          title="Filtrar por projeto, prioridade, tag ou prazo"
          className={`${BOTAO_ICONE} ${filtrosAbertos || filtrosExtras > 0 ? BOTAO_ICONE_ATIVO : BOTAO_ICONE_INATIVO}`}
        >
          <SlidersHorizontal size={17} />
          {filtrosExtras > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-accent px-1 text-[10px] font-bold text-white">
              {filtrosExtras}
            </span>
          )}
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          {ATALHOS_PRAZO.map((at) => {
            const Icone = at.icone;
            const ativo = filtros.atalho === at.id;
            const n = contagemAtalho[at.id] ?? 0;
            return (
              <button
                key={at.id}
                type="button"
                onClick={() => alternarAtalho(at.id)}
                aria-pressed={ativo}
                className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors ${
                  ativo ? at.ativo : "border-brand-border bg-white text-brand-muted hover:bg-brand-hover"
                }`}
              >
                <Icone size={13} />
                {at.label}
                <span className={`font-bold ${n > 0 && at.id === "atrasadas" && !ativo ? "text-[#b5392a]" : ""}`}>{n}</span>
              </button>
            );
          })}
        </div>
        {temFiltro && (
          <button
            type="button"
            onClick={() => setFiltros(FILTROS_VAZIOS)}
            className="flex items-center gap-1 text-[12.5px] font-semibold text-brand-accent hover:underline"
          >
            <X size={13} />
            Limpar
          </button>
        )}
      </div>

      {filtrosAbertos && (
        <div className="mb-3 grid grid-cols-1 gap-2 rounded-2xl border border-brand-border bg-white p-3 shadow-card sm:grid-cols-2 lg:grid-cols-4">
          <Select value={filtros.projetoId} onChange={(e) => alterarFiltro("projetoId", e.target.value)} aria-label="Projeto">
            <option value="">Todos os projetos</option>
            <option value="sem">Sem projeto</option>
            {projetosComAnotacao.map((p) => (
              <option key={p.id} value={p.id}>
                {nomeProjeto(p)}
              </option>
            ))}
          </Select>
          <Select value={filtros.prioridade} onChange={(e) => alterarFiltro("prioridade", e.target.value as "" | PrioridadeAnotacao)} aria-label="Prioridade">
            <option value="">Qualquer prioridade</option>
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                Prioridade {PRIORIDADE_ANOTACAO[p].label.toLowerCase()}
              </option>
            ))}
          </Select>
          <Select value={filtros.tag} onChange={(e) => alterarFiltro("tag", e.target.value)} aria-label="Tag" disabled={sugestoesTags.length === 0}>
            <option value="">{sugestoesTags.length === 0 ? "Nenhuma tag criada" : "Todas as tags"}</option>
            {sugestoesTags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-[12.5px] whitespace-nowrap text-brand-muted">
            Prazo até
            <Input type="date" value={filtros.prazoAte} onChange={(e) => alterarFiltro("prazoAte", e.target.value)} />
          </label>
        </div>
      )}

      {(erroAcao || erro) && (
        <p className="mb-3 rounded-md bg-[#fdeceb] p-3 text-[13px] text-[#b5392a]">
          {erroAcao || "Não foi possível carregar suas anotações. Confira se as regras do Firestore foram publicadas."}
        </p>
      )}

      {visao === "lista" ? (
        <ListaAnotacoes anotacoes={filtradas} contextoDe={contextoDe} hojeIso={hojeIso} onAbrir={(a) => setEditando(a)} />
      ) : visao === "projetos" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {resumoPorProjeto(ativas)
            .sort((a, b) => b.total - a.total)
            .map((r) => {
              const projeto = r.projetoId ? projetos.find((p) => p.id === r.projetoId) : undefined;
              const nome = r.projetoId ? (projeto ? nomeProjeto(projeto) : "Projeto removido") : "Sem projeto";
              const status = (Object.keys(STATUS_ANOTACAO) as StatusAnotacao[]).filter((s) => r.porStatus[s] > 0);
              return (
                <button
                  key={r.projetoId ?? "sem"}
                  type="button"
                  onClick={() => {
                    setFiltros({ ...FILTROS_VAZIOS, projetoId: r.projetoId ?? "sem" });
                    setVisao("kanban");
                  }}
                  title="Ver as anotações deste projeto no quadro"
                  className="rounded-2xl border border-brand-border bg-white p-4 text-left shadow-card transition-colors hover:bg-brand-hover/60"
                >
                  <div className="mb-3 flex items-start gap-2.5">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${r.projetoId ? "bg-brand-accent-soft text-brand-accent" : "bg-brand-hover text-brand-faint"}`}
                    >
                      <FolderKanban size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-extrabold text-brand-navy-2">{nome}</p>
                      <p className="text-[12px] text-brand-muted">
                        {r.total} anotaç{r.total === 1 ? "ão" : "ões"}
                      </p>
                    </div>
                  </div>
                  <div className="mb-2 flex h-1.5 overflow-hidden rounded-full bg-brand-hover">
                    {status.map((s) => (
                      <span key={s} style={{ width: `${(r.porStatus[s] / r.total) * 100}%`, backgroundColor: STATUS_ANOTACAO[s].cor }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
                    {status.map((s) => {
                      const Icone = ICONE_STATUS[s];
                      return (
                        <span key={s} className="flex items-center gap-1 font-semibold" style={{ color: STATUS_ANOTACAO[s].cor }}>
                          <Icone size={12} />
                          {r.porStatus[s]} {STATUS_ANOTACAO[s].label.toLowerCase()}
                        </span>
                      );
                    })}
                  </div>
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
            {[...filtradas]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((a) => (
                <CartaoAnotacao key={a.id} a={a} projeto={contextoDe(a).projeto} hojeIso={hojeIso} onAbrir={() => setEditando(a)} />
              ))}
          </div>
          {filtradas.length === 0 && <p className="text-[13px] text-brand-faint">Nenhuma anotação arquivada.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {COLUNAS_KANBAN.map((status) => {
            const cfg = STATUS_ANOTACAO[status];
            const Icone = ICONE_STATUS[status];
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
                className={`flex min-h-[340px] flex-col rounded-2xl border border-t-[3px] p-3 transition-colors ${
                  alvo ? "border-brand-accent bg-brand-accent-soft/40" : "border-brand-border bg-brand-hover/40"
                }`}
                style={alvo ? undefined : { borderTopColor: cfg.cor }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: cfg.cor }}>
                    <Icone size={15} />
                    {cfg.label}
                  </p>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: cfg.bg, color: cfg.cor }}>
                    {cartoes.length}
                  </span>
                </div>
                {status === "a_fazer" && (
                  <form onSubmit={criarRapida} className="mb-2">
                    <div className="relative">
                      <Plus size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-brand-faint" />
                      <input
                        value={rapida}
                        onChange={(e) => setRapida(e.target.value)}
                        maxLength={200}
                        disabled={salvandoRapida}
                        placeholder="Anotar algo rápido e tecle Enter"
                        aria-label="Anotação rápida"
                        className="h-10 w-full rounded-xl border border-dashed border-[#cfd5e2] bg-white/70 pr-3 pl-9 text-[13px] text-brand-navy-2 outline-none placeholder:text-brand-faint focus:border-brand-accent focus:bg-white"
                      />
                    </div>
                  </form>
                )}
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
                        projeto={contextoDe(a).projeto}
                        hojeIso={hojeIso}
                        onAbrir={() => setEditando(a)}
                        onConcluir={status !== "concluido" ? () => concluir(a) : undefined}
                        onArquivar={status === "concluido" ? () => arquivar(a) : undefined}
                        onArrastar={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", a.id);
                          setArrastando(a.id);
                        }}
                      />
                    </div>
                  ))}
                  {cartoes.length === 0 && (
                    <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-brand-border p-4 text-center text-[12px] text-brand-faint">
                      {loading ? "Carregando…" : arrastando ? "Solte aqui" : status === "a_fazer" ? "Nada pendente" : "Arraste um cartão para cá"}
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
