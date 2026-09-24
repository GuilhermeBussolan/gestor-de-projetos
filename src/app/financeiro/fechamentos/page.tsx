"use client";

import { Fragment, useMemo, useState } from "react";
import { format, subMonths } from "date-fns";
import { orderBy, where } from "firebase/firestore";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileDown, History, Lock, LockOpen, RotateCcw, Send, ShieldAlert } from "lucide-react";
import { useCollection } from "@/lib/useCollection";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { FinanceiroTabs } from "@/components/layout/FinanceiroTabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { AcaoFechamentoModal } from "@/components/financeiro/AcaoFechamentoModal";
import { formatarHoras } from "@/lib/horas";
import {
  ETAPAS_FECHAMENTO,
  STATUS_FECHAMENTO_CONFIG,
  calcularDivergencias,
  dataBR,
  linhasDosItens,
  type ItemBase,
  montarItens,
  montarParceiros,
  prazoFechamento,
  totaisPorTipo,
} from "@/lib/fechamento";
import { enviarParaRevisao, fechar, liberarFaturamento, reabrir, voltarParaRascunho } from "@/lib/fechamentoDb";
import {
  descreverEscopo,
  exportarFechamentoExcel,
  exportarFechamentoPdf,
  montarFechamentoMensal,
  temDesconto,
} from "@/lib/relatorioFechamento";
import type {
  Cliente,
  EmpresaParceira,
  EventoCalendario,
  Fechamento,
  FechamentoParceiro,
  HistoricoFechamento,
  ItemFechamento,
  Projeto,
  Recurso,
  StatusConfirmacaoFechamento,
  StatusFechamento,
} from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = (ms: number) => new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const CONFIRMACAO: Record<StatusConfirmacaoFechamento, { label: string; bg: string; text: string }> = {
  nao_aplicavel: { label: "—", bg: "transparent", text: "#8b94ad" },
  pendente: { label: "Aguardando o responsável", bg: "#fff2de", text: "#a4650d" },
  confirmado: { label: "Confirmado", bg: "#e3f5ea", text: "#15754c" },
  contestado: { label: "Contestado", bg: "#fdeceb", text: "#b5392a" },
};

type Acao =
  | { tipo: "revisao" }
  | { tipo: "atualizar" }
  | { tipo: "rascunho" }
  | { tipo: "fechar" }
  | { tipo: "liberar" }
  | { tipo: "reabrir" };

function Etapas({ status }: { status: StatusFechamento }) {
  const indice = ETAPAS_FECHAMENTO.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-[12px]">
      {ETAPAS_FECHAMENTO.map((e, i) => {
        const cfg = STATUS_FECHAMENTO_CONFIG[e];
        const atual = i === indice;
        const feita = i < indice;
        return (
          <Fragment key={e}>
            {i > 0 && <span className="text-brand-faint">›</span>}
            <li
              className={`rounded-full px-3 py-1 font-bold ${atual ? "" : feita ? "bg-[#e3f5ea] text-[#15754c]" : "bg-brand-hover text-brand-faint"}`}
              style={atual ? { backgroundColor: cfg.bg, color: cfg.text } : undefined}
            >
              {feita && "✓ "}
              {cfg.label}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

function CartaoTotais({ titulo, horas, valor, detalhe, destaque }: { titulo: string; horas: number; valor: number; detalhe: string; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-card ${destaque ? "border-brand-accent/40 bg-brand-accent-soft/40" : "border-brand-border bg-white"}`}>
      <p className="text-[10.5px] font-bold tracking-[.08em] text-brand-faint uppercase">{titulo}</p>
      <p className="mt-0.5 text-[22px] font-extrabold tracking-[-0.02em] text-brand-navy-2">{moeda(valor)}</p>
      <p className="text-[12px] text-brand-muted">
        {formatarHoras(horas)} · {detalhe}
      </p>
    </div>
  );
}

/** Item do fechamento: congelado (com confirmação) ou calculado ao vivo (sem). */
type ItemExibido = ItemBase & Partial<Pick<ItemFechamento, "liberado" | "confirmacao">>;

function TabelaItens({ itens, parceirosSalvos, mostrarConfirmacao }: { itens: ItemExibido[]; parceirosSalvos: FechamentoParceiro[]; mostrarConfirmacao: boolean }) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const alternar = (id: string) =>
    setAbertos((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Terceiros agrupados por parceira.
  const grupos = useMemo(() => {
    const proprios = itens.filter((i) => i.tipoBox === "proprio");
    const porParceira = new Map<string, typeof itens>();
    itens
      .filter((i) => i.tipoBox === "terceiro")
      .forEach((i) => {
        const chave = i.parceiraNome ?? "Terceiros sem parceira";
        porParceira.set(chave, [...(porParceira.get(chave) ?? []), i]);
      });
    return { proprios, parceiras: Array.from(porParceira.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR")) };
  }, [itens]);

  const cols = 5;
  const linhaItem = (i: (typeof itens)[number]) => {
    const aberto = abertos.has(i.id);
    return (
      <Fragment key={i.id}>
        <tr className="cursor-pointer border-t border-brand-border-soft hover:bg-brand-hover" onClick={() => alternar(i.id)}>
          <td className="px-4 py-2.5 font-semibold text-brand-navy-2">
            <span className="inline-flex items-center gap-1.5">
              {aberto ? <ChevronDown size={14} className="text-brand-faint" /> : <ChevronRight size={14} className="text-brand-faint" />}
              {i.recursoNome}
            </span>
          </td>
          <td className="px-3 py-2.5 text-brand-muted">{i.lancamentos.length}</td>
          <td className="px-3 py-2.5 text-brand-navy-2">{formatarHoras(i.horas)}</td>
          <td className="px-3 py-2.5 font-bold text-brand-navy-2">{moeda(i.valorRepasse)}</td>
          <td className="w-2" />
        </tr>
        {aberto && (
          <tr className="bg-brand-hover/60">
            <td colSpan={cols + 1} className="px-4 py-2">
              <table className="w-full text-[12px]">
                <tbody>
                  {i.lancamentos.map((l, k) => (
                    <tr key={k} className="border-t border-brand-border-soft first:border-t-0">
                      <td className="py-1 pr-3 whitespace-nowrap text-brand-muted">{dataBR(l.data)}</td>
                      <td className="py-1 pr-3 text-brand-navy-2">
                        {l.cliente} — {l.projeto}
                      </td>
                      <td className="py-1 pr-3 whitespace-nowrap text-brand-muted">
                        {l.horaInicio}–{l.horaFim}
                        {l.horaDesconto && l.horaDesconto !== "00:00" ? ` (desc. ${l.horaDesconto})` : ""}
                      </td>
                      <td className="py-1 pr-3 text-right whitespace-nowrap text-brand-navy-2">{formatarHoras(l.totalHoras)}</td>
                      <td className="py-1 text-right font-semibold whitespace-nowrap text-brand-navy-2">{moeda(l.valorRepasse)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  const cabecalho = (
    <tr className="bg-brand-hover text-left text-[10.5px] font-bold tracking-[.08em] text-brand-faint uppercase">
      <th className="px-4 py-2.5">Consultor</th>
      <th className="px-3 py-2.5">Lançamentos</th>
      <th className="px-3 py-2.5">Horas</th>
      <th className="px-3 py-2.5">Valor a repassar</th>
      <th />
    </tr>
  );
  const subtotal = (lista: typeof itens) => ({ h: lista.reduce((s, i) => s + i.horas, 0), v: lista.reduce((s, i) => s + i.valorRepasse, 0) });

  return (
    <div className="space-y-4">
      {[{ titulo: "Recursos próprios", lista: grupos.proprios, parceiro: undefined as FechamentoParceiro | undefined }, ...grupos.parceiras.map(([nome, lista]) => ({
          titulo: `Terceiros — ${nome}`,
          lista,
          parceiro: parceirosSalvos.find((x) => x.parceiraId === (lista[0]?.parceiraId ?? "sem_parceira")),
        }))].map(
        ({ titulo, lista, parceiro }) => {
          const s = subtotal(lista);
          const ciente = !!parceiro?.ciencia?.em;
          const conf = parceiro ? CONFIRMACAO[parceiro.confirmacao.status] : null;
          return (
            <div key={titulo} className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border-soft px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13.5px] font-extrabold text-brand-navy-2">{titulo}</p>
                  {mostrarConfirmacao && parceiro && conf && (
                    <>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                        style={ciente ? { backgroundColor: "#e3f5ea", color: "#15754c" } : { backgroundColor: "#fff2de", color: "#a4650d" }}
                        title={ciente && parceiro.ciencia.em ? `Recebido e lido por ${parceiro.ciencia.porNome ?? "—"} em ${dataHora(parceiro.ciencia.em)}` : "O responsável ainda não confirmou o recebimento"}
                      >
                        {ciente ? "Recebimento confirmado" : "Aguardando ciência"}
                      </span>
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: conf.bg, color: conf.text }}>
                        {parceiro.confirmacao.status === "pendente" ? "Valores a confirmar" : conf.label}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-[12.5px] text-brand-muted">
                  {lista.length} consultor{lista.length === 1 ? "" : "es"} · {formatarHoras(s.h)} · <strong className="text-brand-navy-2">{moeda(s.v)}</strong>
                </p>
              </div>
              {parceiro?.confirmacao.status === "contestado" && parceiro.confirmacao.motivo && (
                <p className="border-b border-brand-border-soft bg-[#fdeceb] px-4 py-2.5 text-[12.5px] text-[#b5392a]">
                  <strong>Contestado por {parceiro.confirmacao.porNome ?? "—"}:</strong> {parceiro.confirmacao.motivo}
                </p>
              )}
              <table className="w-full text-[13px]">
                <thead>{cabecalho}</thead>
                <tbody>
                  {lista.map(linhaItem)}
                  {lista.length === 0 && (
                    <tr>
                      <td colSpan={cols + 1} className="px-4 py-6 text-center text-brand-faint">
                        Nenhuma hora aprovada neste período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        }
      )}
    </div>
  );
}

function FechamentosPageContent() {
  const { usuario } = useAuth();
  const { data: eventos } = useCollection<EventoCalendario>("eventosCalendario", []);
  const { data: recursos } = useCollection<Recurso>("recursos");
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const { data: parceiras } = useCollection<EmpresaParceira>("parceiras");
  const { data: fechamentos } = useCollection<Fechamento>("fechamentos", []);

  const hojeIso = format(new Date(), "yyyy-MM-dd");
  const [mesAno, setMesAno] = useState(() => format(subMonths(new Date(), 1), "yyyy-MM"));
  const { data: itensSalvos } = useCollection<ItemFechamento>("fechamentoItens", [where("mesAno", "==", mesAno)], true, [mesAno]);
  const { data: parceirosSalvos } = useCollection<FechamentoParceiro>("fechamentoParceiros", [where("mesAno", "==", mesAno)], true, [mesAno]);
  const { data: historico } = useCollection<HistoricoFechamento>(`fechamentos/${mesAno}/historico`, [orderBy("em", "desc")], true, [mesAno]);

  const [acao, setAcao] = useState<Acao | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [exportando, setExportando] = useState<"pdf" | "excel" | null>(null);
  const [divAbertas, setDivAbertas] = useState<Set<string>>(new Set());

  const fechamento = fechamentos.find((f) => f.id === mesAno) ?? null;
  const status: StatusFechamento = fechamento?.status ?? "rascunho";
  const ator = usuario ? { uid: usuario.uid, nomeCompleto: usuario.nomeCompleto } : null;

  const filtros = useMemo(() => ({ tipo: "" as const, parceiraId: "", recursoId: "" }), []);
  const linhasVivas = useMemo(
    () => montarFechamentoMensal(eventos, recursos, projetos, clientes, parceiras, filtros, mesAno),
    [eventos, recursos, projetos, clientes, parceiras, filtros, mesAno]
  );
  const itensVivos = useMemo(() => montarItens(linhasVivas, recursos, parceiras, mesAno), [linhasVivas, recursos, parceiras, mesAno]);
  const congelado = status !== "rascunho";
  const itensExibidos = useMemo<ItemExibido[]>(
    () => (congelado ? [...itensSalvos].sort((a, b) => a.recursoNome.localeCompare(b.recursoNome, "pt-BR")) : itensVivos),
    [congelado, itensSalvos, itensVivos]
  );
  const totais = useMemo(() => totaisPorTipo(itensExibidos), [itensExibidos]);
  const parceirosVivos = useMemo(() => montarParceiros(itensVivos, parceiras, mesAno), [itensVivos, parceiras, mesAno]);
  const totaisVivos = useMemo(() => totaisPorTipo(itensVivos), [itensVivos]);
  const divergencias = useMemo(
    () => calcularDivergencias({ eventos, recursos, projetos, clientes, linhas: linhasVivas, mesAno }),
    [eventos, recursos, projetos, clientes, linhasVivas, mesAno]
  );
  const bloqueantes = divergencias.filter((d) => d.severidade === "bloqueante");

  // Depois de congelado, as horas do período podem mudar (ex: um apontamento aprovado depois).
  const totalCongelado = totais.proprio.horas + totais.terceiro.horas;
  const totalVivo = totaisVivos.proprio.horas + totaisVivos.terceiro.horas;
  const valorCongelado = totais.proprio.valor + totais.terceiro.valor;
  const valorVivo = totaisVivos.proprio.valor + totaisVivos.terceiro.valor;
  const desatualizado = congelado && (Math.abs(totalCongelado - totalVivo) > 0.01 || Math.abs(valorCongelado - valorVivo) > 0.01);

  const podeEnviarRevisao = itensVivos.length > 0;
  const prazo = prazoFechamento(mesAno);
  const prazoVencido = hojeIso > prazo && status !== "faturado";
  const parceirosAguardandoCiencia = parceirosSalvos.filter((x) => !x.ciencia?.em).length;
  const parceirosPendentes = parceirosSalvos.filter((x) => !!x.ciencia?.em && x.confirmacao.status === "pendente").length;
  const parceirosContestados = parceirosSalvos.filter((x) => x.confirmacao.status === "contestado").length;
  const parceirosConfirmados = parceirosSalvos.filter((x) => x.confirmacao.status === "confirmado").length;

  async function executar(texto: string) {
    if (!acao || !ator) return;
    setProcessando(true);
    setErro("");
    try {
      if (acao.tipo === "revisao" || acao.tipo === "atualizar") {
        await enviarParaRevisao({ mesAno, atual: fechamento, itens: itensVivos, parceiros: parceirosVivos, ator, motivo: texto });
      } else if (acao.tipo === "rascunho") await voltarParaRascunho({ mesAno, ator, motivo: texto });
      else if (acao.tipo === "fechar") await fechar({ mesAno, ator, justificativa: texto });
      else if (acao.tipo === "liberar") await liberarFaturamento({ mesAno, ator, observacao: texto });
      else await reabrir({ mesAno, de: status, ator, motivo: texto });
      setAcao(null);
    } catch (err) {
      console.error("Erro na ação do fechamento:", err);
      setErro("Não foi possível concluir a ação. Confira se as regras do Firestore foram publicadas e tente de novo.");
      setAcao(null);
    } finally {
      setProcessando(false);
    }
  }

  async function exportar(formato: "pdf" | "excel") {
    setExportando(formato);
    setErro("");
    try {
      const linhas = congelado ? linhasDosItens(itensSalvos) : linhasVivas;
      const escopo = { ...descreverEscopo({ tipo: "", parceiraId: "", recursoId: "" }, null), incluirDesconto: temDesconto(linhas) };
      if (formato === "pdf") await exportarFechamentoPdf(linhas, escopo, mesAno, "/logo-navy.png");
      else await exportarFechamentoExcel(linhas, escopo, mesAno, "/logo-navy.png");
    } catch (err) {
      console.error("Erro ao exportar:", err);
      setErro("Não foi possível gerar o arquivo. Tente de novo.");
    } finally {
      setExportando(null);
    }
  }

  const cfgStatus = STATUS_FECHAMENTO_CONFIG[status];
  const [ano, mes] = mesAno.split("-");

  const modal = acao && (
    <AcaoFechamentoModal
      titulo={
        {
          revisao: "Enviar para revisão",
          atualizar: "Atualizar valores da revisão",
          rascunho: "Voltar para rascunho",
          fechar: bloqueantes.length > 0 ? "Fechar com divergências" : "Fechar o mês",
          liberar: "Liberar faturamento",
          reabrir: "Reabrir fechamento",
        }[acao.tipo]
      }
      descricao={
        {
          revisao: "Congela o valor de cada consultor com as horas aprovadas até agora. Você poderá atualizar ou voltar para rascunho enquanto estiver em revisão.",
          atualizar: "Recalcula os valores com as horas aprovadas atuais e substitui os valores congelados.",
          rascunho: "Descarta os valores congelados. O fechamento volta a ser calculado ao vivo.",
          fechar:
            bloqueantes.length > 0
              ? `Há ${bloqueantes.length} divergência(s) bloqueante(s) em aberto (${bloqueantes.map((b) => b.titulo).join("; ")}). Para fechar assim, registre a justificativa.`
              : "Depois de fechado, o mês pode seguir para a liberação do faturamento.",
          liberar: "Libera o faturamento. Cada consultor terceiro passa a ver o próprio fechamento para conferir e confirmar. Fica registrado quem liberou e quando.",
          reabrir:
            status === "faturado"
              ? "O faturamento deixa de estar liberado, os terceiros deixam de ver o fechamento e as confirmações recomeçam."
              : "O mês volta para a revisão.",
        }[acao.tipo]
      }
      rotulo={
        { revisao: "Observação (opcional)", atualizar: "Observação (opcional)", rascunho: "Motivo", fechar: bloqueantes.length > 0 ? "Justificativa" : "Observação (opcional)", liberar: "Observação da liberação (opcional)", reabrir: "Motivo da reabertura" }[acao.tipo]
      }
      obrigatorio={acao.tipo === "rascunho" || acao.tipo === "reabrir" || (acao.tipo === "fechar" && bloqueantes.length > 0)}
      confirmar={{ revisao: "Enviar para revisão", atualizar: "Atualizar valores", rascunho: "Voltar para rascunho", fechar: "Fechar", liberar: "Liberar faturamento", reabrir: "Reabrir" }[acao.tipo]}
      perigo={acao.tipo === "reabrir" || acao.tipo === "rascunho"}
      processando={processando}
      onCancelar={() => setAcao(null)}
      onConfirmar={executar}
    />
  );

  return (
    <div>
      <FinanceiroTabs />
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Fechamentos</h1>
        <span className="rounded-full px-3 py-1 text-[12px] font-bold" style={{ backgroundColor: cfgStatus.bg, color: cfgStatus.text }}>
          {cfgStatus.label}
        </span>
      </div>
      <p className="mb-5 text-sm text-brand-muted">
        Do fechamento das horas do mês até a liberação do faturamento. Recursos próprios e terceiros ficam separados, e os terceiros agrupados por parceira.
      </p>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[12.5px] font-bold text-brand-navy-2">Mês de referência</label>
            <Input type="month" value={mesAno} onChange={(e) => e.target.value && setMesAno(e.target.value)} className="w-44" />
          </div>
          <Etapas status={status} />
          <span
            className={`rounded-full px-3 py-1 text-[12px] font-bold ${prazoVencido ? "bg-[#fdeceb] text-[#b5392a]" : "bg-brand-hover text-brand-muted"}`}
            title="O fechamento do mês acontece do dia 1 ao dia 10 do mês seguinte (referência; nada é bloqueado por data)"
          >
            Prazo: {dataBR(prazo)}
            {prazoVencido ? " · vencido" : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={itensExibidos.length === 0 || !!exportando} onClick={() => exportar("pdf")} className="h-9 px-3.5 text-[13px]">
            <FileDown size={15} />
            {exportando === "pdf" ? "Gerando..." : "PDF"}
          </Button>
          <Button variant="secondary" disabled={itensExibidos.length === 0 || !!exportando} onClick={() => exportar("excel")} className="h-9 px-3.5 text-[13px]">
            <FileDown size={15} />
            {exportando === "excel" ? "Gerando..." : "Excel"}
          </Button>
        </div>
      </div>

      {erro && <p className="mb-4 rounded-md bg-[#fdeceb] p-3 text-sm font-medium text-[#b5392a]">{erro}</p>}

      {/* Ações do status atual */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-2xl border border-brand-border bg-white p-4 shadow-card">
        {status === "rascunho" && (
          <>
            <Button onClick={() => setAcao({ tipo: "revisao" })} disabled={!podeEnviarRevisao}>
              <Send size={15} />
              Enviar para revisão
            </Button>
            <span className="text-[12.5px] text-brand-muted">
              {itensVivos.length === 0 ? "Nenhuma hora aprovada neste período." : "Congela o valor de cada consultor e de cada parceira para conferência."}
            </span>
          </>
        )}
        {status === "em_revisao" && (
          <>
            <Button onClick={() => setAcao({ tipo: "fechar" })}>
              <Lock size={15} />
              Fechar o mês
            </Button>
            <Button variant="secondary" onClick={() => setAcao({ tipo: "atualizar" })}>
              <RotateCcw size={15} />
              Atualizar valores
            </Button>
            <Button variant="secondary" onClick={() => setAcao({ tipo: "rascunho" })}>
              Voltar para rascunho
            </Button>
          </>
        )}
        {status === "fechado" && (
          <>
            <Button onClick={() => setAcao({ tipo: "liberar" })}>
              <CheckCircle2 size={15} />
              Liberar faturamento
            </Button>
            <Button variant="secondary" onClick={() => setAcao({ tipo: "reabrir" })}>
              <LockOpen size={15} />
              Reabrir
            </Button>
            <span className="text-[12.5px] text-brand-muted">
              Fechado em {fechamento?.fechadoEm ? dataHora(fechamento.fechadoEm) : "—"} por {fechamento?.fechadoPorNome ?? "—"}.
            </span>
          </>
        )}
        {status === "faturado" && (
          <>
            <span className="text-[13px] font-semibold text-[#15754c]">
              Faturamento liberado em {fechamento?.liberadoEm ? dataHora(fechamento.liberadoEm) : "—"} por {fechamento?.liberadoPorNome ?? "—"}.
            </span>
            <Button variant="secondary" onClick={() => setAcao({ tipo: "reabrir" })} className="ml-auto">
              <LockOpen size={15} />
              Reabrir
            </Button>
          </>
        )}
      </div>

      {fechamento?.justificativaDivergencias && (
        <p className="mb-4 rounded-md bg-[#fff2de] p-3 text-[12.5px] text-[#a4650d]">
          <strong>Fechado com divergências justificadas:</strong> {fechamento.justificativaDivergencias}
        </p>
      )}
      {status === "faturado" && fechamento?.observacaoLiberacao && (
        <p className="mb-4 rounded-md bg-brand-hover p-3 text-[12.5px] text-brand-muted">
          <strong className="text-brand-navy-2">Observação da liberação:</strong> {fechamento.observacaoLiberacao}
        </p>
      )}
      {desatualizado && (
        <p className="mb-4 flex items-start gap-2 rounded-md bg-[#fff2de] p-3 text-[12.5px] font-medium text-[#a4650d]">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          As horas aprovadas do período mudaram depois que os valores foram congelados (hoje: {formatarHoras(totalVivo)} e {moeda(valorVivo)}; no
          fechamento: {formatarHoras(totalCongelado)} e {moeda(valorCongelado)}).
          {status === "em_revisao" ? " Use “Atualizar valores” para refletir a mudança." : " Reabra o fechamento se for preciso corrigir."}
        </p>
      )}
      {status === "faturado" && parceirosSalvos.length > 0 && (
        <p className="mb-4 text-[12.5px] text-brand-muted">
          Conferência das parceiras: <strong className="text-[#a4650d]">{parceirosAguardandoCiencia} aguardando ciência</strong> ·{" "}
          <strong className="text-[#a4650d]">{parceirosPendentes} a confirmar valores</strong> ·{" "}
          <strong className="text-[#15754c]">{parceirosConfirmados} confirmada(s)</strong> ·{" "}
          <strong className="text-[#b5392a]">{parceirosContestados} contestada(s)</strong>. A nota fiscal só é solicitada depois da confirmação.
        </p>
      )}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CartaoTotais
          titulo={`Total — ${mes}/${ano}`}
          horas={totais.proprio.horas + totais.terceiro.horas}
          valor={totais.proprio.valor + totais.terceiro.valor}
          detalhe={`${totais.proprio.recursos + totais.terceiro.recursos} consultores`}
          destaque
        />
        <CartaoTotais titulo="Recursos próprios" horas={totais.proprio.horas} valor={totais.proprio.valor} detalhe={`${totais.proprio.recursos} consultores`} />
        <CartaoTotais titulo="Recursos terceiros" horas={totais.terceiro.horas} valor={totais.terceiro.valor} detalhe={`${totais.terceiro.recursos} consultores`} />
      </div>

      {/* Divergências */}
      <div className="mb-5 rounded-2xl border border-brand-border bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2 text-[14px] font-extrabold text-brand-navy-2">
          <ShieldAlert size={17} className={bloqueantes.length > 0 ? "text-[#b5392a]" : divergencias.length > 0 ? "text-[#a4650d]" : "text-[#15754c]"} />
          Relatório de divergências
          <span className="text-[12px] font-medium text-brand-muted">
            {divergencias.length === 0 ? "— nada a conferir" : `— ${bloqueantes.length} bloqueante(s), ${divergencias.length - bloqueantes.length} alerta(s)`}
          </span>
        </div>
        {divergencias.length === 0 && <p className="text-[13px] text-[#15754c]">Nenhuma divergência encontrada neste período.</p>}
        <div className="space-y-2">
          {divergencias.map((d) => {
            const aberta = divAbertas.has(d.chave);
            const bloq = d.severidade === "bloqueante";
            return (
              <div key={d.chave} className={`overflow-hidden rounded-xl border ${bloq ? "border-[#f3b8b0] bg-[#fdeceb]" : "border-[#f3dcb8] bg-[#fff8ec]"}`}>
                <button
                  type="button"
                  onClick={() =>
                    setDivAbertas((p) => {
                      const n = new Set(p);
                      if (n.has(d.chave)) n.delete(d.chave);
                      else n.add(d.chave);
                      return n;
                    })
                  }
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
                >
                  <span className={`text-[13px] font-bold ${bloq ? "text-[#b5392a]" : "text-[#a4650d]"}`}>
                    {bloq ? "Bloqueante · " : "Alerta · "}
                    {d.titulo}
                  </span>
                  {aberta ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
                {aberta && (
                  <ul className="max-h-56 space-y-0.5 overflow-y-auto border-t border-black/5 bg-white/60 px-4 py-2.5 text-[12.5px] text-brand-navy-2">
                    {d.detalhes.map((linha, i) => (
                      <li key={i}>{linha}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <TabelaItens itens={itensExibidos} parceirosSalvos={parceirosSalvos} mostrarConfirmacao={status === "faturado"} />

      {/* Auditoria */}
      <div className="mt-6 rounded-2xl border border-brand-border bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2 text-[14px] font-extrabold text-brand-navy-2">
          <History size={16} className="text-brand-faint" />
          Histórico de status
        </div>
        {historico.length === 0 ? (
          <p className="text-[13px] text-brand-faint">Nenhuma mudança de status registrada para este mês.</p>
        ) : (
          <ul className="divide-y divide-brand-border-soft">
            {historico.map((h) => (
              <li key={h.id} className="py-2.5 text-[13px]">
                <p className="text-brand-navy-2">
                  <strong>{h.acao}</strong> <span className="text-brand-faint">— {h.usuarioNome} · {dataHora(h.em)}</span>
                </p>
                <p className="text-[12px] text-brand-faint">
                  {h.de ? STATUS_FECHAMENTO_CONFIG[h.de].label : "Novo"} → {STATUS_FECHAMENTO_CONFIG[h.para].label}
                </p>
                {h.motivo && <p className="mt-0.5 text-[12.5px] text-brand-muted">Motivo/observação: {h.motivo}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal}
    </div>
  );
}

export default function FechamentosPage() {
  return (
    <ProtectedPage perfis={["administrador", "financeiro"]}>
      <FechamentosPageContent />
    </ProtectedPage>
  );
}
