import { timingSafeEqual } from "node:crypto";
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
  "bloqueiosAgenda",
] as const;

const RETENCAO_DIAS = 30;

/**
 * Só a Vercel (o cron, que manda "Authorization: Bearer <CRON_SECRET>") pode disparar o backup. Sem o segredo
 * configurado a rota fica fechada — antes, sem ele, "Bearer undefined" passava. A comparação é em tempo constante.
 */
function autorizado(request: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo || segredo.length < 16) return false;
  const recebido = Buffer.from(request.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
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
