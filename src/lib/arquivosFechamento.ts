import { collection, doc, getDoc, getDocs, orderBy, query, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ArquivoFechamento } from "@/types";

/**
 * Arquivos do fechamento (PDF da nota fiscal, comprovantes de pagamento e documentos complementares) guardados
 * no próprio Firestore — sem o Firebase Storage, que exige plano pago. Cada arquivo é dividido em "partes" de
 * texto (base64) porque um documento do Firestore aceita até 1 MB. Por isso o limite é de 3 MB por arquivo.
 *
 *   arquivosFechamento/{id}            -> dados do arquivo (nome, tamanho, tipo, a quem pertence)
 *   arquivosFechamento/{id}/partes/{n} -> as partes do conteúdo
 */
export const TAMANHO_MAXIMO_BYTES = 3 * 1024 * 1024;
const TAMANHO_PARTE = 700_000; // caracteres base64 por parte (abaixo de 1 MB por documento)

export const MENSAGEM_ERRO_ARQUIVO =
  "Não foi possível enviar ou abrir o arquivo. Confirme que as regras do Firestore foram publicadas e tente de novo.";

export type TipoArquivoFechamento = "nf" | "comprovante" | "anexo";

function lerComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(leitor.error ?? new Error("Falha ao ler o arquivo."));
    leitor.onload = () => {
      const texto = String(leitor.result ?? "");
      resolve(texto.slice(texto.indexOf(",") + 1));
    };
    leitor.readAsDataURL(arquivo);
  });
}

/**
 * Tipo REAL do arquivo pelos primeiros bytes (a "assinatura" de cada formato), sem confiar no que o navegador de quem
 * enviou informou — senão uma página HTML com script poderia ser enviada como "PDF" e rodaria dentro do sistema ao
 * ser aberta. Só estes três formatos abrem numa aba; qualquer outro arquivo é sempre baixado.
 */
type TipoSeguro = "application/pdf" | "image/png" | "image/jpeg";

function tipoPelaAssinatura(bytes: Uint8Array): TipoSeguro | null {
  const comeca = (...b: number[]) => b.every((v, i) => bytes[i] === v);
  if (comeca(0x25, 0x50, 0x44, 0x46)) return "application/pdf"; // %PDF
  if (comeca(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (comeca(0xff, 0xd8, 0xff)) return "image/jpeg";
  return null;
}

/** O que cada tipo de arquivo do fechamento aceita: NF só PDF; comprovante PDF ou imagem; anexo do Financeiro, qualquer um. */
const ACEITOS: Record<TipoArquivoFechamento, TipoSeguro[] | null> = {
  nf: ["application/pdf"],
  comprovante: ["application/pdf", "image/png", "image/jpeg"],
  anexo: null,
};

/** Envia um arquivo (até 3 MB) e devolve os metadados a guardar no documento do fechamento (`path` = id do arquivo). */
export async function enviarArquivo(
  contexto: { mesAno: string; parceiraId: string | null; tipo: TipoArquivoFechamento; autorUid: string },
  arquivo: File
): Promise<ArquivoFechamento> {
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) throw new Error("O arquivo passa de 3 MB.");
  const tipoReal = tipoPelaAssinatura(new Uint8Array(await arquivo.slice(0, 8).arrayBuffer()));
  const aceitos = ACEITOS[contexto.tipo];
  if (aceitos && (!tipoReal || !aceitos.includes(tipoReal))) {
    throw new Error(
      contexto.tipo === "nf"
        ? "Formato inválido: a nota fiscal precisa ser um arquivo PDF."
        : "Formato inválido: envie um PDF ou uma imagem (PNG ou JPG)."
    );
  }
  const base64 = await lerComoBase64(arquivo);
  const partes: string[] = [];
  for (let i = 0; i < base64.length; i += TAMANHO_PARTE) partes.push(base64.slice(i, i + TAMANHO_PARTE));

  const ref = doc(collection(db, "arquivosFechamento"));
  const lote = writeBatch(db);
  const agora = Date.now();
  lote.set(ref, {
    mesAno: contexto.mesAno,
    parceiraId: contexto.parceiraId,
    tipo: contexto.tipo,
    nome: arquivo.name,
    tamanho: arquivo.size,
    // Gravado pelo conteúdo real; formatos fora da lista ficam como "arquivo genérico" (só para baixar).
    contentType: tipoReal ?? "application/octet-stream",
    partes: partes.length,
    criadoEm: agora,
    criadoPorId: contexto.autorUid,
  });
  partes.forEach((dados, n) => lote.set(doc(ref, "partes", String(n).padStart(4, "0")), { n, dados }));
  await lote.commit();
  return { nome: arquivo.name, path: ref.id, tamanho: arquivo.size, em: agora };
}

function base64ParaBytes(partes: string[]): Uint8Array<ArrayBuffer> {
  const binario = atob(partes.join(""));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/**
 * Abre o arquivo (reconstrói o conteúdo a partir das partes; o acesso segue as regras do Firestore). PDF, PNG e JPG
 * verdadeiros abrem numa aba; qualquer outro conteúdo — inclusive arquivos antigos gravados com um tipo "de fachada" —
 * é baixado, nunca aberto, para não executar nada dentro do sistema.
 */
export async function abrirArquivo(arquivo: Pick<ArquivoFechamento, "path">): Promise<void> {
  // A aba é aberta antes da leitura para o navegador não bloquear como pop-up.
  const janela = window.open("", "_blank");
  try {
    const ref = doc(db, "arquivosFechamento", arquivo.path);
    const meta = await getDoc(ref);
    if (!meta.exists()) throw new Error("Arquivo não encontrado.");
    const partesSnap = await getDocs(query(collection(ref, "partes"), orderBy("n", "asc")));
    const bytes = base64ParaBytes(partesSnap.docs.map((d) => String(d.data().dados ?? "")));
    const tipoReal = tipoPelaAssinatura(bytes);

    if (!tipoReal) {
      janela?.close();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = String(meta.data().nome ?? "arquivo");
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
      return;
    }

    const url = URL.createObjectURL(new Blob([bytes], { type: tipoReal }));
    if (janela) janela.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  } catch (err) {
    janela?.close();
    throw err;
  }
}
