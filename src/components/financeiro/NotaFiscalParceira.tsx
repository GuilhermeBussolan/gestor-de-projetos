"use client";

import { useState } from "react";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormRow, Input } from "@/components/ui/Field";
import { LinkArquivo } from "@/components/financeiro/LinkArquivo";
import { useAuth } from "@/contexts/AuthContext";
import { enviarNotaFiscal } from "@/lib/fechamentoNfDb";
import { MENSAGEM_ERRO_ARQUIVO, TAMANHO_MAXIMO_BYTES } from "@/lib/arquivosFechamento";
import { situacaoDaParceira, totalPago } from "@/lib/fechamentoNf";
import type { FechamentoParceiro } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = (ms: number) => new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const dataBR = (iso: string) => iso.split("-").reverse().join("/");
const NOME_ACAO: Record<string, string> = { enviada: "NF enviada", reenviada: "NF reenviada", validada: "NF validada", rejeitada: "NF rejeitada" };

/**
 * Passo 3 do fechamento, do lado do responsável da parceira: depois de confirmar os valores ele envia a
 * nota fiscal (número, data de emissão, valor e PDF), acompanha a validação do Financeiro e vê os pagamentos.
 */
export function NotaFiscalParceira({ f }: { f: FechamentoParceiro }) {
  const { usuario } = useAuth();
  const [numero, setNumero] = useState(f.nf?.numero ?? "");
  const [dataEmissao, setDataEmissao] = useState(f.nf?.dataEmissao ?? "");
  const [valor, setValor] = useState(String(f.nf?.valor ?? f.valor));
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  if (f.confirmacao.status !== "confirmado") return null;
  const situacao = situacaoDaParceira(f);
  const podeEnviar = !f.nf || f.nf.status === "rejeitada";
  const pagamentos = f.pagamentos ?? [];

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario) return;
    const v = Number(valor.replace(",", "."));
    if (!numero.trim() || !dataEmissao || !Number.isFinite(v) || v <= 0) {
      setErro("Informe número, data de emissão e valor da nota fiscal.");
      return;
    }
    if (!arquivo && !f.nf?.arquivo) {
      setErro("Anexe o PDF da nota fiscal.");
      return;
    }
    if (arquivo && arquivo.size > TAMANHO_MAXIMO_BYTES) {
      setErro("O PDF passa de 3 MB. Reduza o arquivo (ex.: exportar novamente com menor qualidade) e tente de novo.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      await enviarNotaFiscal({
        fechamento: f,
        dados: { numero, dataEmissao, valor: v },
        arquivo,
        ator: { uid: usuario.uid, nomeCompleto: usuario.nomeCompleto },
      });
      setArquivo(null);
    } catch (err) {
      console.error("Erro ao enviar a nota fiscal:", err);
      setErro(err instanceof Error && err.message.includes("3 MB") ? err.message : MENSAGEM_ERRO_ARQUIVO);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-border bg-white p-4">
      <p className="mb-2 flex items-center gap-2 text-[13px] font-bold text-brand-navy-2">
        <FileText size={15} className="text-brand-faint" />
        3. Nota fiscal
      </p>

      {f.nf?.status === "rejeitada" && (
        <p className="mb-3 rounded-md bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[#b5392a]">
          <strong>Nota rejeitada pelo Financeiro:</strong> {f.nf.motivoRejeicao}. Corrija e envie novamente.
        </p>
      )}

      {f.nf && !podeEnviar && (
        <div className="space-y-1 text-[13px]">
          <p className="text-brand-navy-2">
            NF <strong>{f.nf.numero}</strong> · emitida em {dataBR(f.nf.dataEmissao)} · <strong>{moeda(f.nf.valor)}</strong>
          </p>
          {f.nf.arquivo && <LinkArquivo arquivo={f.nf.arquivo} />}
          <p className={f.nf.status === "validada" ? "text-[#15754c]" : "text-[#0f7d9e]"}>
            {f.nf.status === "validada"
              ? `Validada por ${f.nf.validadoPorNome ?? "—"}${f.nf.validadoEm ? ` em ${dataHora(f.nf.validadoEm)}` : ""}. O pagamento será registrado pelo Financeiro.`
              : `Enviada em ${dataHora(f.nf.enviadoEm)} — aguardando a validação do Financeiro.`}
          </p>
        </div>
      )}

      {podeEnviar && (
        <form onSubmit={enviar} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormRow label="Número da nota">
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} required />
          </FormRow>
          <FormRow label="Data de emissão">
            <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} required />
          </FormRow>
          <FormRow label="Valor (R$)">
            <Input type="number" step="0.01" min="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required />
          </FormRow>
          <div className="sm:col-span-3">
            <label className="mb-1 block text-[12.5px] font-bold text-brand-navy-2">PDF da nota fiscal</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="block w-full text-[12.5px] text-brand-muted file:mr-3 file:rounded-[8px] file:border file:border-brand-border file:bg-white file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold file:text-brand-navy-2"
            />
            <p className="mt-1 text-[11.5px] text-brand-faint">
              Valor calculado do fechamento: <strong>{moeda(f.valor)}</strong>. A nota deve ser da {f.parceiraNome}, referente a este mês.
            </p>
          </div>
          {erro && <p className="text-[12.5px] font-semibold text-red-600 sm:col-span-3">{erro}</p>}
          <div className="flex justify-end sm:col-span-3">
            <Button type="submit" disabled={enviando}>
              <Upload size={15} />
              {enviando ? "Enviando..." : f.nf ? "Reenviar nota fiscal" : "Enviar nota fiscal"}
            </Button>
          </div>
        </form>
      )}

      {pagamentos.length > 0 && (
        <div className="mt-4 border-t border-brand-border-soft pt-3">
          <p className="mb-1.5 text-[12.5px] font-bold text-brand-navy-2">Pagamentos registrados</p>
          <ul className="space-y-1 text-[12.5px] text-brand-muted">
            {pagamentos.map((p) => (
              <li key={p.id}>
                {dataBR(p.data)} · {p.forma} · <strong className="text-brand-navy-2">{moeda(p.valor)}</strong>
                {p.referencia ? ` · ref. ${p.referencia}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[12.5px] font-semibold text-brand-navy-2">
            {situacao === "encerrado"
              ? "Pagamento concluído — fechamento encerrado."
              : `Pago ${moeda(totalPago(f))} de ${moeda(f.valor)}.`}
          </p>
        </div>
      )}

      {(f.historicoNf ?? []).length > 0 && (
        <details className="mt-3 text-[12px] text-brand-muted">
          <summary className="cursor-pointer font-semibold">Histórico da nota fiscal</summary>
          <ul className="mt-1.5 space-y-0.5">
            {[...(f.historicoNf ?? [])]
              .sort((a, b) => b.em - a.em)
              .map((h, i) => (
                <li key={i}>
                  {NOME_ACAO[h.acao]} — {h.porNome} · {dataHora(h.em)}
                  {h.motivo ? ` · ${h.motivo}` : ""}
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}
