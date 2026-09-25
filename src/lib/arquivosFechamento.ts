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

/** Envia um arquivo (até 3 MB) e devolve os metadados a guardar no documento do fechamento (`path` = id do arquivo). */
export async function enviarArquivo(
  contexto: { mesAno: string; parceiraId: string | null; tipo: TipoArquivoFechamento; autorUid: string },
  arquivo: File
): Promise<ArquivoFechamento> {
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) throw new Error("O arquivo passa de 3 MB.");
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
    contentType: arquivo.type || "application/octet-stream",
    partes: partes.length,
    criadoEm: agora,
    criadoPorId: contexto.autorUid,
  });
  partes.forEach((dados, n) => lote.set(doc(ref, "partes", String(n).padStart(4, "0")), { n, dados }));
  await lote.commit();
  return { nome: arquivo.name, path: ref.id, tamanho: arquivo.size, em: agora };
}

function base64ParaBlob(partes: string[], contentType: string): Blob {
  const binario = atob(partes.join(""));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

/** Abre o arquivo em outra aba (reconstrói o conteúdo a partir das partes; o acesso segue as regras do Firestore). */
export async function abrirArquivo(arquivo: Pick<ArquivoFechamento, "path">): Promise<void> {
  // A aba é aberta antes da leitura para o navegador não bloquear como pop-up.
  const janela = window.open("", "_blank");
  try {
    const ref = doc(db, "arquivosFechamento", arquivo.path);
    const meta = await getDoc(ref);
    if (!meta.exists()) throw new Error("Arquivo não encontrado.");
    const partesSnap = await getDocs(query(collection(ref, "partes"), orderBy("n", "asc")));
    const blob = base64ParaBlob(
      partesSnap.docs.map((d) => String(d.data().dados ?? "")),
      String(meta.data().contentType ?? "application/octet-stream")
    );
    const url = URL.createObjectURL(blob);
    if (janela) janela.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  } catch (err) {
    janela?.close();
    throw err;
  }
}
