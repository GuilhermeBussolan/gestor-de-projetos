# Gestor de Projetos

Sistema web da NG Informática para acompanhar projetos de implantação: cadastros, cronograma e agenda dos
consultores, apontamento de horas e financeiro (faturamento e fechamento mensal de repasse às parceiras).

> Contexto detalhado, regras de negócio e combinados de trabalho: veja o [`CLAUDE.md`](./CLAUDE.md).

## O que o sistema faz

- **Projetos**: cadastro com cliente, módulo, envolvidos, documentos (MIT), escopo e cronograma; termômetro e linha do tempo.
- **Cronograma**: importação de planilha (padrão MIT032 ou tabular com coluna *Nível*), com **histórico de versões**
  e observação a cada importação; a ordem e o conteúdo podem mudar durante o projeto sem perder o que já foi realizado.
- **Agenda**: cada tarefa vira previsto no calendário do consultor e no **Mapa de Alocação** (manhã/tarde de 4h por dia).
- **Apontamento de horas**: o consultor lança e confirma, o coordenador aprova; comparativo previsto x realizado; OS em PDF.
- **Financeiro**: liberação de parcelas, faturamento previsto x realizado e **Fechamentos** mensais (rascunho → revisão →
  fechado → faturamento liberado), com conferência do responsável de cada empresa parceira.

## Perfis de acesso

| Perfil | Acessa |
|---|---|
| Administrador | Tudo |
| Coordenador | Projetos, calendário, apontamento/aprovação, mapa de alocação (sem financeiro) |
| Consultor | Própria agenda e apontamentos; atualiza cronograma e envolvidos dos seus projetos |
| Financeiro | Módulo Financeiro |
| Responsável da parceira | Confere e confirma o fechamento mensal da própria empresa |

## Tecnologias

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Firebase (Auth + Firestore) · Vercel ·
jsPDF, ExcelJS, docx e papaparse para relatórios e importações.

## Rodando localmente

Pré-requisitos: Node.js 20+ e acesso ao projeto Firebase.

```bash
npm install
cp .env.local.example .env.local   # preencha com as chaves do Firebase (Console > Configurações do projeto)
npm run dev -- -p 3100             # http://localhost:3100
```

> **Atenção:** o ambiente local usa o mesmo banco do Firebase de produção. O que você grava no localhost é gravado de verdade.

Verificações antes de publicar:

```bash
npx tsc --noEmit && npx eslint src && npm run build
```

## Publicação

- **Aplicação**: cada push na branch `main` gera um deploy de Produção na Vercel. Se o deploy não aparecer, um commit
  vazio (`git commit --allow-empty`) reenvia o gatilho.
- **Regras do Firestore** (`firestore.rules`): **não são publicadas pelo deploy.** Após alterar o arquivo, cole o conteúdo
  em Firebase Console → Firestore Database → Regras → Publicar.
- Variáveis de ambiente de produção (incluindo a chave do Firebase Admin, `FIREBASE_SERVICE_ACCOUNT_KEY`) ficam nas
  configurações do projeto na Vercel — nunca no repositório.

## Estrutura

```
src/app/            páginas (App Router): projetos, calendário, apontamento, financeiro, cadastros, api/
src/components/     componentes por módulo (projetos, calendario, apontamento, financeiro, importacao, layout, ui)
src/lib/            regras de negócio e utilitários (cronograma, escopo, fechamento, importadores, relatórios)
src/types/          tipos compartilhados (Projeto, EscopoAtividade, Fechamento, Perfil...)
firestore.rules     regras de segurança do Firestore
```

## Próximos passos

- Acompanhar o uso do fechamento mensal (nota fiscal do parceiro, pagamentos e reconciliação já implementados) e ajustar conforme a rotina do Financeiro.

> Os arquivos do fechamento (PDF da nota fiscal, comprovantes e documentos) ficam no próprio **Firestore** (até 3 MB
> cada), então o projeto roda no plano gratuito do Firebase, sem o Storage.
