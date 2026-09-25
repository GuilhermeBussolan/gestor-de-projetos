"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, MessageSquareWarning } from "lucide-react";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { AcaoFechamentoModal } from "@/components/financeiro/AcaoFechamentoModal";
import { useAuth } from "@/contexts/AuthContext";
import { useMeuFechamento } from "@/lib/useMeuFechamento";
import { responderConfirmacaoConsultor } from "@/lib/fechamentoDb";
import { dataBR } from "@/lib/fechamento";
import { formatarHoras } from "@/lib/horas";
import type { ItemFechamento } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = (ms: number) => new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const nomeMes = (mesAno: string) => {
  const t = new Date(`${mesAno}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function situacao(i: ItemFechamento): { label: string; bg: string; text: string } {
  if (i.confirmacao.status === "confirmado") return { label: "Confirmado", bg: "#e3f5ea", text: "#15754c" };
  if (i.confirmacao.status === "contestado") return { label: "Contestado — em análise", bg: "#fdeceb", text: "#b5392a" };
  return { label: "Aguardando a sua confirmação", bg: "#fff2de", text: "#a4650d" };
}

function CartaoMes({ item }: { item: ItemFechamento }) {
  const { usuario } = useAuth();
  const [aberto, setAberto] = useState(item.confirmacao.status === "pendente");
  const [acao, setAcao] = useState<"confirmar" | "contestar" | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const cfg = situacao(item);
  const podeResponder = item.confirmacao.status === "pendente" || item.confirmacao.status === "contestado";

  async function responder(decisao: "confirmado" | "contestado", motivo?: string) {
    if (!usuario) return;
    setProcessando(true);
    setErro("");
    try {
      await responderConfirmacaoConsultor({
        mesAno: item.mesAno,
        recursoId: item.recursoId,
        parceiraDocId: `${item.mesAno}_${item.parceiraId ?? "sem_parceira"}`,
        decisao,
        nome: usuario.nomeCompleto,
        motivo,
      });
      setAcao(null);
    } catch (err) {
      console.error("Erro ao responder o fechamento:", err);
      setErro("Não foi possível registrar sua resposta. Se a nota fiscal da sua empresa já foi enviada, fale com o Financeiro.");
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
            {nomeMes(item.mesAno)}
          </p>
          <p className="ml-6 text-[12.5px] text-brand-muted">
            {item.parceiraNome ?? "Terceiro"} · {item.lancamentos.length} lançamento{item.lancamentos.length === 1 ? "" : "s"} · {formatarHoras(item.horas)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[17px] font-extrabold text-brand-navy-2">{moeda(item.valorRepasse)}</span>
          <span className="rounded-full px-3 py-1 text-[11.5px] font-bold" style={{ backgroundColor: cfg.bg, color: cfg.text }}>
            {cfg.label}
          </span>
        </div>
      </button>

      {aberto && (
        <div className="space-y-4 border-t border-brand-border-soft px-5 py-4">
          <div className="overflow-x-auto rounded-xl border border-brand-border">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-brand-hover text-left text-[10.5px] font-bold tracking-[.08em] text-brand-faint uppercase">
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Cliente — projeto</th>
                  <th className="px-3 py-2">Horário</th>
                  <th className="px-3 py-2 text-right">Horas</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {item.lancamentos.map((l, i) => (
                  <tr key={i} className="border-t border-brand-border-soft">
                    <td className="px-3 py-1.5 whitespace-nowrap text-brand-muted">{dataBR(l.data)}</td>
                    <td className="px-3 py-1.5 text-brand-navy-2">
                      {l.cliente} — {l.projeto}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-brand-muted">
                      {l.horaInicio}–{l.horaFim}
                      {l.horaDesconto && l.horaDesconto !== "00:00" ? ` (desc. ${l.horaDesconto})` : ""}
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap text-brand-navy-2">{formatarHoras(l.totalHoras)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold whitespace-nowrap text-brand-navy-2">{moeda(l.valorRepasse)}</td>
                  </tr>
                ))}
                <tr className="border-t border-brand-border bg-brand-hover font-bold text-brand-navy-2">
                  <td className="px-3 py-2" colSpan={3}>
                    Total
                  </td>
                  <td className="px-3 py-2 text-right">{formatarHoras(item.horas)}</td>
                  <td className="px-3 py-2 text-right">{moeda(item.valorRepasse)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {item.confirmacao.status === "confirmado" && (
            <p className="text-[12.5px] text-[#15754c]">
              Você confirmou{item.confirmacao.em ? ` em ${dataHora(item.confirmacao.em)}` : ""}. Quando todos os consultores da sua empresa confirmarem, a
              empresa envia a nota fiscal.
            </p>
          )}
          {item.confirmacao.status === "contestado" && item.confirmacao.motivo && (
            <p className="rounded-md bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[#b5392a]">
              <strong>Sua contestação:</strong> {item.confirmacao.motivo}
            </p>
          )}
          {erro && <p className="text-[12.5px] font-semibold text-red-600">{erro}</p>}

          {podeResponder && (
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <span className="mr-auto text-[12.5px] text-brand-muted">Se estiver de acordo, confirme; se houver erro, conteste explicando.</span>
              <Button variant="secondary" onClick={() => setAcao("contestar")}>
                <MessageSquareWarning size={15} />
                Contestar
              </Button>
              <Button onClick={() => setAcao("confirmar")}>
                <CheckCircle2 size={15} />
                {item.confirmacao.status === "contestado" ? "Confirmar mesmo assim" : "Confirmar minhas horas"}
              </Button>
            </div>
          )}
        </div>
      )}

      {acao && (
        <AcaoFechamentoModal
          titulo={acao === "confirmar" ? `Confirmar ${nomeMes(item.mesAno)}` : `Contestar ${nomeMes(item.mesAno)}`}
          descricao={
            acao === "confirmar"
              ? `Você confirma ${formatarHoras(item.horas)} e ${moeda(item.valorRepasse)} referentes a ${nomeMes(item.mesAno)}?`
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

function MeuFechamentoContent() {
  const { usuario } = useAuth();
  const { itens, pendentes, loading, erro } = useMeuFechamento(usuario);

  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Meu fechamento</h1>
      <p className="mb-5 text-sm text-brand-muted">
        Quando o faturamento do mês da sua empresa é liberado, você confere as suas horas e os seus valores e confirma (ou contesta). A nota fiscal só é
        enviada depois que todos os consultores da empresa confirmarem.
      </p>
      {pendentes > 0 && (
        <p className="mb-4 rounded-md bg-[#fff2de] p-3 text-[13px] font-semibold text-[#a4650d]">
          Você tem {pendentes} fechamento{pendentes === 1 ? "" : "s"} aguardando a sua confirmação.
        </p>
      )}
      {erro && <p className="mb-4 rounded-md bg-[#fdeceb] p-3 text-sm text-[#b5392a]">Não foi possível carregar os fechamentos.</p>}
      <div className="flex flex-col gap-3">
        {itens.map((i) => (
          <CartaoMes key={i.id} item={i} />
        ))}
        {!loading && !erro && itens.length === 0 && (
          <p className="rounded-2xl border border-dashed border-brand-border bg-white p-8 text-center text-sm text-brand-faint">Nenhum fechamento liberado para você ainda.</p>
        )}
      </div>
    </div>
  );
}

export default function MeuFechamentoPage() {
  return (
    <ProtectedPage perfis={["consultor"]}>
      <MeuFechamentoContent />
    </ProtectedPage>
  );
}
