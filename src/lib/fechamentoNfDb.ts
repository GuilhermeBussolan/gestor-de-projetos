import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { enviarArquivo } from "@/lib/arquivosFechamento";
import type { Ator } from "@/lib/fechamentoDb";
import type { EventoNf, FechamentoParceiro, FormaPagamento, NotaFiscalParceiro, PagamentoParceiro } from "@/types";

const limpar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const refDoc = (id: string) => doc(db, "fechamentoParceiros", id);

/** A parceira envia (ou reenvia, se a anterior foi rejeitada) a nota fiscal: número, data, valor e PDF. */
export async function enviarNotaFiscal({
  fechamento: f,
  dados,
  arquivo,
  ator,
}: {
  fechamento: FechamentoParceiro;
  dados: { numero: string; dataEmissao: string; valor: number };
  arquivo: File | null;
  ator: Ator;
}) {
  const anexo = arquivo ? await enviarArquivo({ mesAno: f.mesAno, parceiraId: f.parceiraId, tipo: "nf", autorUid: ator.uid }, arquivo) : (f.nf?.arquivo ?? null);
  const nf: NotaFiscalParceiro = {
    numero: dados.numero.trim(),
    dataEmissao: dados.dataEmissao,
    valor: dados.valor,
    arquivo: anexo,
    status: "enviada",
    enviadoEm: Date.now(),
    enviadoPorNome: ator.nomeCompleto,
    validadoEm: null,
    validadoPorNome: null,
    motivoRejeicao: null,
    divergenciaValor: false,
    justificativaDivergencia: null,
  };
  const evento: EventoNf = { acao: f.nf ? "reenviada" : "enviada", em: Date.now(), porNome: ator.nomeCompleto, numero: nf.numero };
  await updateDoc(refDoc(f.id), { nf: limpar(nf), historicoNf: arrayUnion(limpar(evento)) });
}

/** O financeiro valida a NF (confere período, parceira e valor). Se o valor difere do fechamento, exige justificativa. */
export async function validarNotaFiscal({ fechamento: f, ator, justificativa }: { fechamento: FechamentoParceiro; ator: Ator; justificativa?: string }) {
  if (!f.nf) throw new Error("Sem nota fiscal para validar.");
  const diverge = Math.abs(f.nf.valor - f.valor) > 0.005;
  const nf: NotaFiscalParceiro = {
    ...f.nf,
    status: "validada",
    validadoEm: Date.now(),
    validadoPorNome: ator.nomeCompleto,
    motivoRejeicao: null,
    divergenciaValor: diverge,
    justificativaDivergencia: diverge ? (justificativa?.trim() ?? null) : null,
  };
  const evento: EventoNf = {
    acao: "validada",
    em: Date.now(),
    porNome: ator.nomeCompleto,
    numero: nf.numero,
    motivo: diverge ? justificativa?.trim() || null : null,
  };
  await updateDoc(refDoc(f.id), { nf: limpar(nf), historicoNf: arrayUnion(limpar(evento)) });
}

/** O financeiro rejeita a NF com motivo; a parceira corrige e reenvia. */
export async function rejeitarNotaFiscal({ fechamento: f, ator, motivo }: { fechamento: FechamentoParceiro; ator: Ator; motivo: string }) {
  if (!f.nf) throw new Error("Sem nota fiscal para rejeitar.");
  const nf: NotaFiscalParceiro = { ...f.nf, status: "rejeitada", validadoEm: null, validadoPorNome: null, motivoRejeicao: motivo.trim() };
  const evento: EventoNf = { acao: "rejeitada", em: Date.now(), porNome: ator.nomeCompleto, numero: nf.numero, motivo: motivo.trim() };
  await updateDoc(refDoc(f.id), { nf: limpar(nf), historicoNf: arrayUnion(limpar(evento)) });
}

/** Registra um pagamento (só depois da NF validada — a tela já bloqueia antes disso). */
export async function registrarPagamento({
  fechamento: f,
  dados,
  comprovante,
  ator,
}: {
  fechamento: FechamentoParceiro;
  dados: { valor: number; data: string; forma: FormaPagamento; referencia: string };
  comprovante: File | null;
  ator: Ator;
}) {
  if (f.nf?.status !== "validada") throw new Error("O pagamento só pode ser registrado depois que a NF for validada.");
  const anexo = comprovante ? await enviarArquivo({ mesAno: f.mesAno, parceiraId: f.parceiraId, tipo: "comprovante", autorUid: ator.uid }, comprovante) : null;
  const pagamento: PagamentoParceiro = {
    id: `${Date.now()}`,
    valor: dados.valor,
    data: dados.data,
    forma: dados.forma,
    referencia: dados.referencia.trim(),
    comprovante: anexo,
    registradoEm: Date.now(),
    registradoPorNome: ator.nomeCompleto,
  };
  await updateDoc(refDoc(f.id), { pagamentos: arrayUnion(limpar(pagamento)) });
}

/** Remove um pagamento lançado por engano. */
export async function removerPagamento({ fechamento: f, pagamentoId }: { fechamento: FechamentoParceiro; pagamentoId: string }) {
  await updateDoc(refDoc(f.id), { pagamentos: (f.pagamentos ?? []).filter((p) => p.id !== pagamentoId) });
}
