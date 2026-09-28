// Cria o PRIMEIRO administrador de uma instalação nova do Gestor de Projetos (e os tipos de documento padrão, se
// ainda não existirem). Roda só na máquina de quem instala, com a chave de serviço do Firebase — nenhuma senha fica
// no código nem no site. Depois disso, os demais usuários são criados pela tela Cadastros → Usuários.
//
// Uso (na raiz do projeto, com FIREBASE_SERVICE_ACCOUNT_KEY no .env.local ou no ambiente):
//   node scripts/criar-primeiro-admin.mjs email@empresa.com "Nome Completo"
//
// A senha é gerada aleatoriamente e mostrada UMA vez no terminal: troque-a no primeiro acesso (menu da conta → Trocar senha).

import { randomInt } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const DOCUMENTOS_PADRAO = [
  { codigo: "MIT024", descricao: "KICK-OFF", pesoIndividual: 5 },
  { codigo: "MIT041", descricao: "DIAGRAMA DE PROCESSOS", pesoIndividual: 15 },
  { codigo: "MIT010A", descricao: "VALIDAÇÃO DAS CONFIGURAÇÕES, PARAMETRIZAÇÕES E INTEGRAÇÃO", pesoIndividual: 10 },
  { codigo: "MIT010B", descricao: "VALIDAÇÃO DA CAPACITAÇÕES", pesoIndividual: 30 },
  { codigo: "MIT045", descricao: "SIMULAÇÃO DE PROCESSOS", pesoIndividual: 10 },
  { codigo: "MIT010C", descricao: "GO-LIVE", pesoIndividual: 10 },
  { codigo: "MIT054", descricao: "PLANO DE CUT-OVER", pesoIndividual: 10 },
  { codigo: "MIT005", descricao: "ACOMPANHAMENTO", pesoIndividual: 5 },
  { codigo: "MIT062", descricao: "TERMO DE ENCERRAMENTO", pesoIndividual: 5 },
];

/** Lê FIREBASE_SERVICE_ACCOUNT_KEY do ambiente ou do .env.local (o valor é o JSON inteiro da chave de serviço). */
function chaveDeServico() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) return process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (existsSync(".env.local")) {
    const linha = readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("FIREBASE_SERVICE_ACCOUNT_KEY="));
    const valor = linha?.slice("FIREBASE_SERVICE_ACCOUNT_KEY=".length).trim().replace(/^'(.*)'$/, "$1");
    if (valor) return valor;
  }
  throw new Error("Configure FIREBASE_SERVICE_ACCOUNT_KEY (no ambiente ou no .env.local) antes de rodar.");
}

/** Senha aleatória de 16 caracteres com maiúscula, minúscula, número e símbolo. */
function gerarSenha() {
  const grupos = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%*-_+?"];
  const todos = grupos.join("");
  const chars = grupos.map((g) => g[randomInt(g.length)]);
  while (chars.length < 16) chars.push(todos[randomInt(todos.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const [email, nomeCompleto] = process.argv.slice(2);
if (!email || !nomeCompleto || !email.includes("@")) {
  console.error('Uso: node scripts/criar-primeiro-admin.mjs email@empresa.com "Nome Completo"');
  process.exit(1);
}

const app = initializeApp({ credential: cert(JSON.parse(chaveDeServico())) });
const auth = getAuth(app);
const db = getFirestore(app);

const senha = gerarSenha();
let usuario;
try {
  usuario = await auth.createUser({ email: email.trim(), password: senha, displayName: nomeCompleto.trim() });
} catch (err) {
  if (err?.code === "auth/email-already-exists") {
    console.error("Esse e-mail já existe no Firebase Auth. Use outro, ou ajuste o perfil dele pela tela de Usuários.");
    process.exit(1);
  }
  throw err;
}

await db.collection("usuarios").doc(usuario.uid).set({
  nomeCompleto: nomeCompleto.trim(),
  email: email.trim(),
  perfil: "administrador",
  recursoId: null,
  parceiraId: null,
  createdAt: Date.now(),
});

const tipos = await db.collection("tiposDocumento").limit(1).get();
if (tipos.empty) {
  const lote = db.batch();
  DOCUMENTOS_PADRAO.forEach((d, ordem) => lote.set(db.collection("tiposDocumento").doc(), { ...d, ordem }));
  await lote.commit();
  console.log(`Tipos de documento padrão criados (${DOCUMENTOS_PADRAO.length}).`);
}

console.log("\nAdministrador criado:");
console.log(`  E-mail: ${email.trim()}`);
console.log(`  Senha:  ${senha}`);
console.log("\nGuarde a senha agora (ela não é salva em lugar nenhum) e troque-a no primeiro acesso.");
