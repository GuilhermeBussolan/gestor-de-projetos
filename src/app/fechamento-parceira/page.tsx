"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, MailCheck, MessageSquareWarning } from "lucide-react";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { AcaoFechamentoModal } from "@/components/financeiro/AcaoFechamentoModal";
import { useAuth } from "@/contexts/AuthContext";
import { useFechamentoParceira } from "@/lib/useFechamentoParceira";
import { registrarCiencia, responderConfirmacao } from "@/lib/fechamentoDb";
import { dataBR } from "@/lib/fechamento";
import { formatarHoras } from "@/lib/horas";
import type { FechamentoParceiro } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = (ms: number) => new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const nomeMes = (mesAno: string) => {
  const t = new Date(`${mesAno}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function situacao(f: FechamentoParceiro): { label: string; bg: string; text: string } {
  if (f.confirmacao.status === "confirmado") return { label: "Confirmado", bg: "#e3f5ea", text: "#15754c" };
  if (f.confirmacao.status === "contestado") return { label: "Contestado — em análise", bg: "#fdeceb", text: "#b5392a" };
  if (!f.ciencia?.em) return { label: "Aguardando confirmar o recebimento", bg: "#fff2de", text: "#a4650d" };
  return { label: "Aguardando confirmar os valores", bg: "#fff2de", text: "#a4650d" };
}

function CartaoMes({ f }: { f: FechamentoParceiro }) {
  const { usuario } = useAuth();
  const ciente = !!f.ciencia?.em;
  const [aberto, setAberto] = useState(f.confirmacao.status === "pendente");
  const [recursosAbertos, setRecursosAbertos] = useState<Set<string>>(new Set());
  const [acao, setAcao] = useState<"confirmar" | "contestar" | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const cfg = situacao(f);
  const podeResponder = ciente && (f.confirmacao.status === "pendente" || f.confirmacao.status === "contestado");

  async function confirmarRecebimento() {
    if (!usuario) return;
    setProcessando(true);
    setErro("");
    try {
      await registrarCiencia({ id: f.id, nome: usuario.nomeCompleto });
    } catch (err) {
      console.error("Erro ao registrar o recebimento:", err);
      setErro("Não foi possível registrar. Tente novamente.");
    } finally {
      setProcessando(false);
    }
  }

  async function responder(decisao: "confirmado" | "contestado", motivo?: string) {
    if (!usuario) return;
    setProcessando(true);
    setErro("");
    try {
      await responderConfirmacao({ id: f.id, decisao, nome: usuario.nomeCompleto, motivo });
      setAcao(null);
    } catch (err) {
      console.error("Erro ao responder o fechamento:", err);
      setErro("Não foi possível registrar sua resposta. Tente novamente.");
      setAcao(null);
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
      <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-brand-hover/60">
        <div>
          <p className="flex items-center gap-2 text-base font-extrabold text-brand-navy-2">
            {aberto ? <ChevronDown size={16} className="text-brand-faint" /> : <ChevronRight size={16} className="text-brand-faint" />}
            {nomeMes(f.mesAno)}
          </p>
          <p className="ml-6 text-[12.5px] text-brand-muted">
            {f.parceiraNome} · {f.recursos.length} consultor{f.recursos.length === 1 ? "" : "es"} · {formatarHoras(f.horas)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[17px] font-extrabold text-brand-navy-2">{moeda(f.valor)}</span>
          <span className="rounded-full px-3 py-1 text-[11.5px] font-bold" style={{ backgroundColor: cfg.bg, color: cfg.text }}>
            {cfg.label}
          </span>
        </div>
      </button>

      {aberto && (
        <div className="space-y-4 border-t border-brand-border-soft px-5 py-4">
          {/* Passo 1 — recebimento */}
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${ciente ? "border-[#b9e2cb] bg-[#f1faf5]" : "border-[#f0c48a] bg-[#fff8ec]"}`}>
            <div className="text-[13px]">
              <p className={`font-bold ${ciente ? "text-[#15754c]" : "text-[#a4650d]"}`}>1. Recebimento e leitura</p>
              <p className="text-brand-muted">
                {ciente && f.ciencia.em
                  ? `Confirmado por ${f.ciencia.porNome ?? "você"} em ${dataHora(f.ciencia.em)}.`
                  : `O faturamento de ${nomeMes(f.mesAno)} foi liberado. Confirme que você recebeu e leu esta mensagem para poder conferir os valores.`}
              </p>
            </div>
            {!ciente && (
              <Button onClick={confirmarRecebimento} disabled={processando}>
                <MailCheck size={15} />
                {processando ? "Registrando..." : "Recebi e li"}
              </Button>
            )}
          </div>

          {/* Consultores da parceira */}
          <div>
            <p className="mb-2 text-[13px] font-bold text-brand-navy-2">2. Confira as horas e os valores</p>
            <div className="divide-y divide-brand-border-soft overflow-hidden rounded-xl border border-brand-border">
              {f.recursos.map((r) => {
                const abertoR = recursosAbertos.has(r.recursoId);
                return (
                  <div key={r.recursoId}>
                    <button
                      type="button"
                      onClick={() =>
                        setRecursosAbertos((p) => {
                          const n = new Set(p);
                          if (n.has(r.recursoId)) n.delete(r.recursoId);
                          else n.add(r.recursoId);
                          return n;
                        })
                      }
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-brand-hover"
                    >
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-navy-2">
                        {abertoR ? <ChevronDown size={14} className="text-brand-faint" /> : <ChevronRight size={14} className="text-brand-faint" />}
                        {r.recursoNome}
                      </span>
                      <span className="text-[12.5px] text-brand-muted">
                        {r.lancamentos.length} lançamento{r.lancamentos.length === 1 ? "" : "s"} · {formatarHoras(r.horas)} ·{" "}
                        <strong className="text-brand-navy-2">{moeda(r.valorRepasse)}</strong>
                      </span>
                    </button>
                    {abertoR && (
                      <div className="overflow-x-auto bg-brand-hover/60 px-4 py-2">
                        <table className="w-full text-[12px]">
                          <tbody>
                            {r.lancamentos.map((l, i) => (
                              <tr key={i} className="border-t border-brand-border-soft first:border-t-0">
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
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex items-center justify-between bg-brand-hover px-4 py-2.5 text-[13px] font-bold text-brand-navy-2">
                <span>Total da empresa</span>
                <span>
                  {formatarHoras(f.horas)} · {moeda(f.valor)}
                </span>
              </div>
            </div>
          </div>

          {f.confirmacao.status === "confirmado" && (
            <p className="text-[12.5px] text-[#15754c]">
              Valores confirmados por {f.confirmacao.porNome ?? "você"}
              {f.confirmacao.em ? ` em ${dataHora(f.confirmacao.em)}` : ""}. O próximo passo é a nota fiscal, que será solicitada pelo Financeiro.
            </p>
          )}
          {f.confirmacao.status === "contestado" && f.confirmacao.motivo && (
            <p className="rounded-md bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[#b5392a]">
              <strong>Sua contestação:</strong> {f.confirmacao.motivo}
            </p>
          )}
          {erro && <p className="text-[12.5px] font-semibold text-red-600">{erro}</p>}

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {!ciente && <span className="mr-auto text-[12.5px] text-brand-faint">Confirme o recebimento (passo 1) para poder confirmar ou contestar os valores.</span>}
            {podeResponder && (
              <>
                <span className="mr-auto text-[12.5px] text-brand-muted">Se estiver de acordo, confirme; se houver erro, conteste explicando.</span>
                <Button variant="secondary" onClick={() => setAcao("contestar")}>
                  <MessageSquareWarning size={15} />
                  Contestar
                </Button>
                <Button onClick={() => setAcao("confirmar")}>
                  <CheckCircle2 size={15} />
                  {f.confirmacao.status === "contestado" ? "Confirmar mesmo assim" : "Confirmar valores"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {acao && (
        <AcaoFechamentoModal
          titulo={acao === "confirmar" ? `Confirmar ${nomeMes(f.mesAno)}` : `Contestar ${nomeMes(f.mesAno)}`}
          descricao={
            acao === "confirmar"
              ? `Você confirma ${formatarHoras(f.horas)} e ${moeda(f.valor)} da ${f.parceiraNome} referentes a ${nomeMes(f.mesAno)}?`
              : "Explique o que está errado (horas, datas ou valores). O Financeiro vai analisar e, se preciso, reabrir o fechamento."
          }
          rotulo={acao === "confirmar" ? "Observação (opcional)" : "O que está errado"}
          obrigatorio={acao === "contestar"}
          confirmar={acao === "confirmar" ? "Confirmar" : "Enviar contestação"}
          perigo={acao === "contestar"}
          processando={processando}
          onCancelar={() => setAcao(null)}
          onConfirmar={(texto) => responder(acao === "confirmar" ? "confirmado" : "contestado", texto)}
        />
      )}
    </div>
  );
}

function FechamentoParceiraContent() {
  const { usuario } = useAuth();
  const { itens, pendentes, loading, erro } = useFechamentoParceira(usuario);

  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Fechamento da parceira</h1>
      <p className="mb-5 text-sm text-brand-muted">
        Quando o faturamento do mês é liberado, você confirma que recebeu e leu, confere as horas e os valores dos consultores da sua empresa e
        confirma (ou contesta). Depois da confirmação, o Financeiro solicita a nota fiscal.
      </p>
      {pendentes > 0 && (
        <p className="mb-4 rounded-md bg-[#fff2de] p-3 text-[13px] font-semibold text-[#a4650d]">
          Você tem {pendentes} fechamento{pendentes === 1 ? "" : "s"} aguardando a sua resposta.
        </p>
      )}
      {usuario && !usuario.parceiraId && (
        <p className="mb-4 rounded-md bg-[#fdeceb] p-3 text-sm text-[#b5392a]">
          Seu usuário ainda não está ligado a uma empresa parceira. Peça a um administrador para vincular em Cadastros → Usuários.
        </p>
      )}
      {erro && <p className="mb-4 rounded-md bg-[#fdeceb] p-3 text-sm text-[#b5392a]">Não foi possível carregar os fechamentos.</p>}
      <div className="flex flex-col gap-3">
        {itens.map((f) => (
          <CartaoMes key={f.id} f={f} />
        ))}
        {!loading && !erro && itens.length === 0 && (
          <p className="rounded-2xl border border-dashed border-brand-border bg-white p-8 text-center text-sm text-brand-faint">
            Nenhum fechamento liberado para a sua empresa ainda.
          </p>
        )}
      </div>
    </div>
  );
}

export default function FechamentoParceiraPage() {
  return (
    <ProtectedPage perfis={["responsavel_parceira"]}>
      <FechamentoParceiraContent />
    </ProtectedPage>
  );
}
