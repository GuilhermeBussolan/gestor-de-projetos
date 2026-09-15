const API = "https://api.github.com";
const PASTA = "backups";

function repoEnv(): string {
  const repo = process.env.GITHUB_BACKUP_REPO;
  if (!repo) throw new Error("GITHUB_BACKUP_REPO não configurado.");
  return repo;
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

export async function salvarBackupNoGithub(nomeArquivo: string, conteudo: string) {
  const repo = repoEnv();
  const conteudoBase64 = Buffer.from(conteudo, "utf-8").toString("base64");

  const resp = await fetch(`${API}/repos/${repo}/contents/${PASTA}/${nomeArquivo}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({
      message: `backup automático ${nomeArquivo}`,
      content: conteudoBase64,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Falha ao salvar backup no GitHub: ${resp.status} ${await resp.text()}`);
  }
}

export async function listarBackups(): Promise<{ name: string; sha: string }[]> {
  const repo = repoEnv();
  const resp = await fetch(`${API}/repos/${repo}/contents/${PASTA}`, { headers: headers() });
  if (resp.status === 404) return [];
  if (!resp.ok) {
    throw new Error(`Falha ao listar backups no GitHub: ${resp.status} ${await resp.text()}`);
  }
  return resp.json();
}

export async function excluirBackupDoGithub(nomeArquivo: string, sha: string) {
  const repo = repoEnv();
  const resp = await fetch(`${API}/repos/${repo}/contents/${PASTA}/${nomeArquivo}`, {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify({ message: `remove backup antigo ${nomeArquivo}`, sha }),
  });
  if (!resp.ok) {
    throw new Error(`Falha ao excluir backup antigo: ${resp.status} ${await resp.text()}`);
  }
}
