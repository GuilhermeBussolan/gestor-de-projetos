import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminStorage } from "@/lib/firebaseAdmin";

const COLECOES = [
  "usuarios",
  "clientes",
  "recursos",
  "tiposDocumento",
  "projetos",
  "eventosCalendario",
  "apontamentos",
] as const;

const RETENCAO_DIAS = 30;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const db = getAdminDb();
  const dump: Record<string, unknown[]> = {};

  for (const colecao of COLECOES) {
    const snap = await db.collection(colecao).get();
    dump[colecao] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  const dataISO = new Date().toISOString().slice(0, 10);
  const nomeArquivo = `backups/backup-${dataISO}.json`;
  const bucket = getAdminStorage().bucket();

  await bucket.file(nomeArquivo).save(JSON.stringify(dump, null, 2), {
    contentType: "application/json",
  });

  const [arquivos] = await bucket.getFiles({ prefix: "backups/backup-" });
  const antigos = arquivos
    .map((f) => f.name)
    .sort()
    .reverse()
    .slice(RETENCAO_DIAS);
  await Promise.all(antigos.map((nome) => bucket.file(nome).delete({ ignoreNotFound: true })));

  return NextResponse.json({
    ok: true,
    arquivo: nomeArquivo,
    colecoes: Object.fromEntries(COLECOES.map((c) => [c, dump[c].length])),
    removidos: antigos.length,
  });
}
