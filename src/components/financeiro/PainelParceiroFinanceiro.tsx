"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileDown, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AcaoFechamentoModal } from "@/components/financeiro/AcaoFechamentoModal";
import { LinkArquivo } from "@/components/financeiro/LinkArquivo";
import { RegistrarPagamentoModal } from "@/components/financeiro/RegistrarPagamentoModal";
import { useAuth } from "@/contexts/AuthContext";
import { formatarHoras } from "@/lib/horas";
import { diferencaPagamento, pagamentoAtrasado, situacaoDaParceira, totalPago, vencimentoDoMes } from "@/lib/fechamentoNf";
import { rejeitarNotaFiscal, removerPagamento, validarNotaFiscal } from "@/lib/fechamentoNfDb";
import type { FechamentoParceiro } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = (ms: number) => new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const dataBR = (iso: string) => iso.split("-").reverse().join("/");
const NOME_ACAO: Record<string, string> = { enviada: "NF enviada", reenviada: "NF reenviada", validada: "NF validada", rejeitada: "NF rejeitada" };

/**
 * Painel do Financeiro para uma parceira no mês: validação da nota fiscal (com conferência e histórico),
 * registro de pagamentos, reconciliação (pago x calculado) e extrato consultor -> horas -> valor -> NF -> pagamento.
 */
export function PainelParceiroFinanceiro({ f, hojeIso, onDocumentoFaturamento }: { f: FechamentoParceiro; hojeIso: string; onDocumentoFaturamento: () => void }) {
  const { usuario } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [conferi, setConferi] = useState(false);
  const [acao, setAcao] = useState<"rejeitar" | "validar_divergente" | null>(null);
  const [pagando, setPagando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");

  const situacao = situacaoDaParceira(f);
  const ator = usuario ? { uid: usuario.uid, nomeCompleto: usuario.nomeCompleto } : null;
  const nf = f.nf ?? null;
  const pagamentos = f.pagamentos ?? [];
  const pago = totalPago(f);
  const dif = diferencaPagamento(f);
  const nfDivergente = !!nf && Math.abs(nf.valor - f.valor) > 0.005;
  const atrasado = pagamentoAtrasado(f, hojeIso);
  const conciliar = pagamentos.length > 0 && Math.abs(dif) > 0.005 && situacao === "encerrado";

  if (!f.liberado || f.confirmacao.status !== "confirmado") {
    return (
      <div className="border-t border-brand-border-soft px-4 py-2.5 text-[12px] text-brand-faint">
        A nota fiscal só é solicitada depois que a parceira confirmar os valores.
        <button type="button" onClick={onDocumentoFaturamento} className="ml-3 font-semibold text-brand-accent hover:underline">
          Documento de faturamento (PDF)
        </button>
      </div>
    );
  }

  async function executar(fn: () => Promise<void>) {
    setProcessando(true);
    setErro("");
    try {
      await fn();
      setAcao(null);
      setConferi(false);
    } catch (err) {
      console.error("Erro na ação da nota fiscal:", err);
      setErro("Não foi possível concluir a ação. Confira as regras do Firestore e tente de novo.");
      setAcao(null);
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="border-t border-brand-border-soft bg-brand-hover/40 px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[12.5px]">
        <ReceiptText size={15} className="text-brand-faint" />
        <strong className="text-brand-navy-2">Nota fiscal e pagamento</strong>
        {atrasado && (
          <span className="rounded-full bg-[#fdeceb] px-2 py-0.5 text-[10.5px] font-bold text-[#b5392a]">Pagamento atrasado (venc. {dataBR(vencimentoDoMes(f.mesAno))})</span>
        )}
        <button type="button" onClick={onDocumentoFaturamento} className="ml-auto flex items-center gap-1.5 font-semibold text-brand-accent hover:underline">
          <FileDown size={14} />
          Documento de faturamento (PDF)
        </button>
      </div>

      {erro && <p className="mb-2 text-[12.5px] font-semibold text-red-600">{erro}</p>}

      {/* NF */}
      {!nf && <p className="text-[12.5px] text-brand-muted">Aguardando a parceira enviar a nota fiscal.</p>}
      {nf && (
        <div className="rounded-xl border border-brand-border bg-white p-3 text-[12.5px]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-brand-navy-2">
              NF <strong>{nf.numero}</strong> · emissão {dataBR(nf.dataEmissao)} · <strong>{moeda(nf.valor)}</strong>
            </span>
            {nf.arquivo && <LinkArquivo arquivo={nf.arquivo} rotulo="Ver PDF da NF" />}
            <span className="text-brand-faint">enviada por {nf.enviadoPorNome} em {dataHora(nf.enviadoEm)}</span>
          </div>
          {nfDivergente && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[#a4650d]">
              <AlertTriangle size={13} />
              O valor da NF ({moeda(nf.valor)}) difere do valor calculado do fechamento ({moeda(f.valor)}).
            </p>
          )}
          {nf.status === "validada" && (
            <p className="mt-1.5 text-[#15754c]">
              Validada por {nf.validadoPorNome} em {nf.validadoEm ? dataHora(nf.validadoEm) : "—"}
              {nf.justificativaDivergencia ? ` · justificativa: ${nf.justificativaDivergencia}` : ""}.
            </p>
          )}
          {nf.status === "rejeitada" && <p className="mt-1.5 text-[#b5392a]">Rejeitada — motivo: {nf.motivoRejeicao}. Aguardando reenvio da parceira.</p>}

          {nf.status === "enviada" && (
            <div className="mt-3 space-y-2 border-t border-brand-border-soft pt-3">
              <label className="flex items-start gap-2 text-[12.5px] text-brand-navy-2">
                <input type="checkbox" className="mt-0.5" checked={conferi} onChange={(e) => setConferi(e.target.checked)} />
                Conferi: a nota é da {f.parceiraNome}, refere-se a este período ({f.mesAno.split("-").reverse().join("/")}) e o valor confere com o fechamento.
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!conferi || processando}
                  onClick={() => (nfDivergente ? setAcao("validar_divergente") : ator && executar(() => validarNotaFiscal({ fechamento: f, ator })))}
                  className="h-9 px-3.5 text-[13px]"
                >
                  <CheckCircle2 size={15} />
                  Validar nota fiscal
                </Button>
                <Button variant="secondary" disabled={processando} onClick={() => setAcao("rejeitar")} className="h-9 px-3.5 text-[13px]">
                  Rejeitar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pagamento */}
      {nf?.status === "validada" && (
        <div className="mt-3 rounded-xl border border-brand-border bg-white p-3 text-[12.5px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-brand-navy-2">
              Pago <strong>{moeda(pago)}</strong> de <strong>{moeda(f.valor)}</strong>
            </span>
            {situacao !== "encerrado" || conciliar ? (
              <Button variant="secondary" onClick={() => setPagando(true)} className="h-9 px-3.5 text-[13px]">
                Registrar pagamento
              </Button>
            ) : (
              <span className="font-bold text-[#15754c]">Encerrado</span>
            )}
          </div>
          {pagamentos.length > 0 && (
            <ul className="mt-2 divide-y divide-brand-border-soft">
              {pagamentos.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span className="text-brand-muted">
                    {dataBR(p.data)} · {p.forma} · <strong className="text-brand-navy-2">{moeda(p.valor)}</strong>
                    {p.referencia ? ` · ref. ${p.referencia}` : ""}
                  </span>
                  <span className="flex items-center gap-3">
                    {p.comprovante && <LinkArquivo arquivo={p.comprovante} rotulo="Comprovante" />}
                    <button
                      type="button"
                      className="text-[11.5px] font-semibold text-red-600 hover:underline"
                      onClick={() => window.confirm("Remover este pagamento?") && executar(() => removerPagamento({ fechamento: f, pagamentoId: p.id }))}
                    >
                      Remover
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {pagamentos.length > 0 && Math.abs(dif) > 0.005 && (
            <p className="mt-2 flex items-center gap-1.5 rounded-md bg-[#fff2de] px-2.5 py-1.5 font-semibold text-[#a4650d]">
              <AlertTriangle size={13} />
              {dif > 0 ? `Pago ${moeda(dif)} a mais` : `Faltam ${moeda(-dif)}`} em relação ao valor calculado do fechamento.
            </p>
          )}
        </div>
      )}

      {/* Extrato */}
      <button type="button" onClick={() => setAberto((v) => !v)} className="mt-3 flex items-center gap-1 text-[12.5px] font-semibold text-brand-accent hover:underline">
        {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Extrato: consultor → horas → valor → NF → pagamento
      </button>
      {aberto && (
        <div className="mt-2 overflow-x-auto rounded-xl border border-brand-border bg-white">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-brand-hover text-left text-[10.5px] font-bold tracking-[.08em] text-brand-faint uppercase">
                <th className="px-3 py-2">Consultor</th>
                <th className="px-3 py-2 text-right">Horas apontadas</th>
                <th className="px-3 py-2 text-right">Valor calculado</th>
              </tr>
            </thead>
            <tbody>
              {f.recursos.map((r) => (
                <tr key={r.recursoId} className="border-t border-brand-border-soft">
                  <td className="px-3 py-1.5 text-brand-navy-2">{r.recursoNome}</td>
                  <td className="px-3 py-1.5 text-right text-brand-muted">{formatarHoras(r.horas)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-brand-navy-2">{moeda(r.valorRepasse)}</td>
                </tr>
              ))}
              <tr className="border-t border-brand-border bg-brand-hover font-bold text-brand-navy-2">
                <td className="px-3 py-1.5">Total calculado</td>
                <td className="px-3 py-1.5 text-right">{formatarHoras(f.horas)}</td>
                <td className="px-3 py-1.5 text-right">{moeda(f.valor)}</td>
              </tr>
              <tr className="border-t border-brand-border-soft">
                <td className="px-3 py-1.5 text-brand-muted" colSpan={2}>
                  Nota fiscal {nf ? `${nf.numero} (${dataBR(nf.dataEmissao)}) — ${nf.status === "validada" ? "validada" : nf.status === "rejeitada" ? "rejeitada" : "a validar"}` : "— não recebida"}
                </td>
                <td className="px-3 py-1.5 text-right text-brand-navy-2">{nf ? moeda(nf.valor) : "—"}</td>
              </tr>
              <tr className="border-t border-brand-border-soft">
                <td className="px-3 py-1.5 text-brand-muted" colSpan={2}>
                  Pagamentos {pagamentos.length > 0 ? `(${pagamentos.map((p) => `${dataBR(p.data)} ${p.forma}`).join(", ")})` : "— nenhum registrado"}
                </td>
                <td className="px-3 py-1.5 text-right font-semibold text-brand-navy-2">{moeda(pago)}</td>
              </tr>
            </tbody>
          </table>
          {(f.historicoNf ?? []).length > 0 && (
            <ul className="border-t border-brand-border-soft px-3 py-2 text-[11.5px] text-brand-muted">
              {[...(f.historicoNf ?? [])]
                .sort((a, b) => b.em - a.em)
                .map((h, i) => (
                  <li key={i}>
                    {NOME_ACAO[h.acao]} — {h.porNome} · {dataHora(h.em)}
                    {h.motivo ? ` · ${h.motivo}` : ""}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {acao === "rejeitar" && ator && (
        <AcaoFechamentoModal
          titulo="Rejeitar nota fiscal"
          descricao={`A ${f.parceiraNome} vai ver o motivo e poderá corrigir e reenviar a nota.`}
          rotulo="Motivo da rejeição"
          obrigatorio
          confirmar="Rejeitar"
          perigo
          processando={processando}
          onCancelar={() => setAcao(null)}
          onConfirmar={(texto) => executar(() => rejeitarNotaFiscal({ fechamento: f, ator, motivo: texto }))}
        />
      )}
      {acao === "validar_divergente" && ator && nf && (
        <AcaoFechamentoModal
          titulo="Validar nota com valor diferente"
          descricao={`O valor da NF (${moeda(nf.valor)}) difere do valor calculado do fechamento (${moeda(f.valor)}). Para validar assim, registre a justificativa.`}
          rotulo="Justificativa"
          obrigatorio
          confirmar="Validar mesmo assim"
          processando={processando}
          onCancelar={() => setAcao(null)}
          onConfirmar={(texto) => executar(() => validarNotaFiscal({ fechamento: f, ator, justificativa: texto }))}
        />
      )}
      {pagando && <RegistrarPagamentoModal f={f} onFechar={() => setPagando(false)} />}
    </div>
  );
}
