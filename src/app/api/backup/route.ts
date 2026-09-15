import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { excluirBackupDoGithub, listarBackups, salvarBackupNoGithub } from "@/lib/githubBackup";

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
  const nomeArquivo = `backup-${dataISO}.json`;

  await salvarBackupNoGithub(nomeArquivo, JSON.stringify(dump, null, 2));

  const arquivos = await listarBackups();
  const antigos = arquivos
    .map((a) => a.name)
    .filter((nome) => nome.startsWith("backup-"))
    .sort()
    .reverse()
    .slice(RETENCAO_DIAS);

  for (const nome of antigos) {
    const arquivo = arquivos.find((a) => a.name === nome);
    if (arquivo) await excluirBackupDoGithub(nome, arquivo.sha);
  }

  return NextResponse.json({
    ok: true,
    arquivo: nomeArquivo,
    colecoes: Object.fromEntries(COLECOES.map((c) => [c, dump[c].length])),
    removidos: antigos.length,
  });
}
