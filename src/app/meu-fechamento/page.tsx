"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, FileText, MessageSquareWarning } from "lucide-react";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { AcaoFechamentoModal } from "@/components/financeiro/AcaoFechamentoModal";
import { DocumentosDoFinanceiro, NotaFiscalParceira } from "@/components/financeiro/NotaFiscalParceira";
import { useAuth } from "@/contexts/AuthContext";
import { faturamentoLiberado, PERFIS_MEU_FECHAMENTO, useMeuFechamento } from "@/lib/useMeuFechamento";
import { responderConfirmacaoConsultor } from "@/lib/fechamentoDb";
import { dataBR } from "@/lib/fechamento";
import { formatarHoras } from "@/lib/horas";
import { confirmacaoDaParceira, situacaoDaParceira, SITUACAO_PARCEIRO_CONFIG } from "@/lib/fechamentoNf";
import type { FechamentoParceiro, ItemFechamento, StatusConfirmacaoFechamento } from "@/types";

const ROTULO_CONFIRMACAO: Record<StatusConfirmacaoFechamento, string> = {
  confirmado: "confirmou",
  contestado: "contestou",
  pendente: "ainda não confirmou",
  nao_aplicavel: "—",
};

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = (ms: number) => new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const nomeMes = (mesAno: string) => {
  const t = new Date(`${mesAno}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function situacao(i: ItemFechamento): { label: string; bg: string; text: string } {
  if (i.confirmacao.status === "confirmado") return { label: "Confirmado", bg: "#e3f5ea", text: "#15754c" };
  if (i.confirmacao.status === "contestado") return { label: "Contestado — em análise", bg: "#fdeceb", text: "#b5392a" };
  if (i.confirmacao.status === "nao_aplicavel") return { label: "Conferido pela empresa", bg: "#eef1f8", text: "#6a7594" };
  return { label: "Aguardando a sua confirmação", bg: "#fff2de", text: "#a4650d" };
}

/**
 * Nota fiscal da empresa no mês, para quem é o contato 1 da parceira: depois que ele e os colegas confirmam as horas,
 * envia a NF (com o prazo e os dados de recebimento) e acompanha a validação e o pagamento.
 */
function NotaFiscalDaEmpresa({ item, fechamento }: { item: ItemFechamento; fechamento: FechamentoParceiro | undefined }) {
  if (!fechamento) {
    return (
      <p className="rounded-md bg-brand-hover px-3 py-2 text-[12.5px] text-brand-muted">
        Carregando o fechamento da {item.parceiraNome ?? "empresa"}… Se esta mensagem não sair, fale com o Financeiro.
      </p>
    );
  }
  if (confirmacaoDaParceira(fechamento).status !== "confirmado") {
    const status = fechamento.statusConsultores ?? {};
    const faltam = fechamento.recursos.filter((r) => status[r.recursoId] !== "confirmado");
    return (
      <div className="rounded-xl border border-brand-border bg-white p-4 text-[12.5px]">
        <p className="mb-1.5 flex items-center gap-2 text-[13px] font-bold text-brand-navy-2">
          <FileText size={15} className="text-brand-faint" />
          Nota fiscal da {fechamento.parceiraNome}
        </p>
        <p className="text-brand-muted">
          Você é o responsável pelo envio da NF da empresa. O envio é liberado quando todos os consultores confirmarem as horas:
        </p>
        <ul className="mt-1.5 space-y-0.5">
          {faltam.map((r) => (
            <li key={r.recursoId} className={status[r.recursoId] === "contestado" ? "text-[#b5392a]" : "text-[#a4650d]"}>
              {r.recursoNome} {ROTULO_CONFIRMACAO[status[r.recursoId] ?? "pendente"]}
              {status[r.recursoId] === "contestado" ? " — o Financeiro vai analisar" : ""}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <DocumentosDoFinanceiro f={fechamento} />
      <NotaFiscalParceira f={fechamento} titulo={`Nota fiscal da ${fechamento.parceiraNome}`} />
    </div>
  );
}

function CartaoMes({
  item,
  responsavelNf,
  fechamentoParceira,
  nomeResponsavelNf,
}: {
  item: ItemFechamento;
  /** Este consultor é o contato 1 da parceira: envia a NF da empresa. */
  responsavelNf: boolean;
  fechamentoParceira: FechamentoParceiro | undefined;
  /** Nome do contato 1 da parceira (para os demais consultores saberem quem envia a NF). */
  nomeResponsavelNf: string | null;
}) {
  const { usuario } = useAuth();
  const situacaoNf = responsavelNf && fechamentoParceira ? situacaoDaParceira(fechamentoParceira) : null;
  const nfPendente = situacaoNf === "aguardando_nf" || situacaoNf === "nf_rejeitada";
  const [aberto, setAberto] = useState(item.confirmacao.status === "pendente" || item.confirmacao.status === "contestado" || nfPendente);
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
          {situacaoNf && item.confirmacao.status === "confirmado" && (
            <span
              className="rounded-full px-3 py-1 text-[11.5px] font-bold"
              style={{ backgroundColor: SITUACAO_PARCEIRO_CONFIG[situacaoNf].bg, color: SITUACAO_PARCEIRO_CONFIG[situacaoNf].text }}
            >
              {nfPendente ? (situacaoNf === "nf_rejeitada" ? "NF rejeitada — reenviar" : "Enviar NF") : SITUACAO_PARCEIRO_CONFIG[situacaoNf].label}
            </span>
          )}
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
              Você confirmou{item.confirmacao.em ? ` em ${dataHora(item.confirmacao.em)}` : ""}.{" "}
              {!faturamentoLiberado(item)
                ? `Agora o Financeiro fecha o mês e libera o faturamento; depois disso ${responsavelNf ? "você envia" : `${nomeResponsavelNf ?? "o responsável da empresa"} envia`} a nota fiscal.`
                : responsavelNf
                  ? "Quando todos os consultores da sua empresa confirmarem, você envia a nota fiscal logo abaixo."
                  : `Quando todos os consultores da sua empresa confirmarem, ${nomeResponsavelNf ?? "o responsável da empresa"} envia a nota fiscal.`}
            </p>
          )}
          {item.confirmacao.status === "confirmado" && responsavelNf && faturamentoLiberado(item) && (
            <NotaFiscalDaEmpresa item={item} fechamento={fechamentoParceira} />
          )}
          {item.confirmacao.status === "contestado" && item.confirmacao.motivo && (
            <p className="rounded-md bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[#b5392a]">
              <strong>Sua contestação:</strong> {item.confirmacao.motivo}
            </p>
          )}
          {erro && <p className="text-[12.5px] font-semibold text-red-600">{erro}</p>}

          {item.confirmacao.status === "nao_aplicavel" && (
            <p className="rounded-md bg-brand-hover px-3 py-2 text-[12.5px] text-brand-muted">
              Este mês foi liberado antes da confirmação por consultor existir, então a conferência foi feita pela sua empresa. Se algo estiver errado, fale
              com o Financeiro.
            </p>
          )}
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
  const { itens, parceiras, fechamentosParceira, souResponsavelNf, confirmacoesPendentes, nfsPendentes, loading, erro } = useMeuFechamento(usuario);

  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Meu fechamento</h1>
      <p className="mb-5 text-sm text-brand-muted">
        Quando o Financeiro envia o fechamento do mês para revisão, você confere as suas horas e os seus valores e confirma (ou contesta). O mês só é
        fechado depois que todos os consultores da empresa confirmarem, e a nota fiscal é enviada depois que o faturamento for liberado.
      </p>
      {confirmacoesPendentes > 0 && (
        <p className="mb-4 rounded-md bg-[#fff2de] p-3 text-[13px] font-semibold text-[#a4650d]">
          Você tem {confirmacoesPendentes} fechamento{confirmacoesPendentes === 1 ? "" : "s"} aguardando a sua confirmação.
        </p>
      )}
      {nfsPendentes > 0 && (
        <p className="mb-4 rounded-md bg-[#e8efff] p-3 text-[13px] font-semibold text-[#2456b8]">
          {nfsPendentes === 1 ? "Há 1 nota fiscal da sua empresa pronta para envio." : `Há ${nfsPendentes} notas fiscais da sua empresa prontas para envio.`}
        </p>
      )}
      {erro && <p className="mb-4 rounded-md bg-[#fdeceb] p-3 text-sm text-[#b5392a]">Não foi possível carregar os fechamentos.</p>}
      <div className="flex flex-col gap-3">
        {itens.map((i) => (
          <CartaoMes
            key={i.id}
            item={i}
            responsavelNf={souResponsavelNf(i.parceiraId)}
            fechamentoParceira={fechamentosParceira.find((f) => f.id === `${i.mesAno}_${i.parceiraId}`)}
            nomeResponsavelNf={parceiras.find((p) => p.id === i.parceiraId)?.contatos?.[0]?.nome?.trim() || null}
          />
        ))}
        {!loading && !erro && itens.length === 0 && (
          <p className="rounded-2xl border border-dashed border-brand-border bg-white p-8 text-center text-sm text-brand-faint">Nenhum fechamento para você conferir ainda.</p>
        )}
      </div>
    </div>
  );
}

export default function MeuFechamentoPage() {
  return (
    <ProtectedPage perfis={PERFIS_MEU_FECHAMENTO}>
      <MeuFechamentoContent />
    </ProtectedPage>
  );
}
