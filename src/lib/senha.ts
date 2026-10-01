/**
 * Regra de senha do sistema (vale na criação de usuário, no servidor, e na troca de senha): pelo menos 10 caracteres,
 * com letra maiúscula, letra minúscula e número. Devolve a mensagem de erro, ou null quando a senha serve.
 */
export const REGRA_SENHA = "Use pelo menos 10 caracteres, com letra maiúscula, letra minúscula e número.";

export function problemaDaSenha(senha: string): string | null {
  if (senha.length < 10 || !/[A-Z]/.test(senha) || !/[a-z]/.test(senha) || !/[0-9]/.test(senha)) {
    return `Senha fraca. ${REGRA_SENHA}`;
  }
  return null;
}

/** Sugestão de senha forte (16 caracteres) para o administrador repassar a um usuário novo. */
export function gerarSenhaForte(): string {
  const grupos = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%*-_+?"];
  const todos = grupos.join("");
  const aleatorio = (n: number) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % n;
  };
  const chars = grupos.map((g) => g[aleatorio(g.length)]);
  while (chars.length < 16) chars.push(todos[aleatorio(todos.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = aleatorio(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
