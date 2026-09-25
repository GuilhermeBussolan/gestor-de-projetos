@AGENTS.md

# Gestor de Projetos — contexto para o Claude

Sistema web da NG Informática para gerir projetos de implantação: cadastros, cronograma e agenda dos consultores,
apontamento de horas, financeiro (faturamento e fechamento mensal de repasse). Idioma do sistema e da conversa:
**português do Brasil**. Resumo para humanos e instruções de instalação: `README.md`.

## Como trabalhamos (combinado com o usuário)

- O usuário pede a mudança → eu implemento e verifico → o usuário valida no **localhost** → só quando ele diz
  **"pode commitar e subir para produção"** eu commito e dou push na `main`. Nunca commitar/subir por conta própria.
- **O localhost usa o banco de PRODUÇÃO** (mesmo Firebase). Qualquer teste que grava, grava de verdade.
- Servidor local: `npm run dev -- -p 3100`. Antes de commitar: `npx tsc --noEmit`, `npx eslint src` e `npm run build`.
- Commit em português, terminando com a linha `Co-Authored-By` que o ambiente indicar. Nunca commitar a pasta `docs/`
  (notas soltas, fica sem versionar) nem `scripts-locais/` (scripts de uso único, ignorado).
- **Regras do Firestore**: `firestore.rules` está no repositório, mas **o deploy NÃO as publica**. Toda mudança nele
  precisa ser colada pelo usuário em Firebase Console → Firestore → Regras → Publicar. Sempre avisar e, quando pedirem,
  enviar o arquivo completo. Sem isso, o recurso novo falha com "permission denied".
- **Deploy (Vercel)** dispara sozinho a cada push na `main`, mas às vezes não dispara ou atrasa horas. Conferir com
  `curl https://api.github.com/repos/GuilhermeBussolan/gestor-de-projetos/deployments`; se o commit não aparecer,
  reenviar o gatilho com `git commit --allow-empty` + push.
- Não perguntar o óbvio: quando o usuário pede "o recomendado", seguir a recomendação dada.

## Stack

Next.js 16 (App Router, **versões novas com quebras de API — ver `AGENTS.md`**), React 19, TypeScript, Tailwind 4,
Firebase (Auth + Firestore, SDK cliente; `firebase-admin` só nas rotas `src/app/api/*`), Vercel, jsPDF / ExcelJS / docx /
papaparse para relatórios e importações, lucide-react (ícones), date-fns. Variáveis de ambiente: ver `.env.local.example`
(o `.env.local` NÃO vai para o Git; a chave `FIREBASE_SERVICE_ACCOUNT_KEY` fica só na Vercel).

## Perfis de acesso (`Perfil` em `src/types/index.ts`)

- **administrador**: tudo.
- **coordenador**: projetos, calendário, apontamento e aprovação de horas, mapa de alocação. **Não vê NADA de financeiro**
  (nem valores/parcelas no detalhe do projeto, nem faturamento nos formulários, nem valor/hora nos relatórios).
- **consultor**: só a própria agenda/apontamentos; pode importar nova versão do cronograma e editar principais
  envolvidos dos projetos em que está alocado; **não vê** dados comerciais (data de assinatura da proposta).
- **financeiro**: módulo Financeiro (liberação de parcelas, faturamento previsto, fechamentos).
- **responsavel_parceira**: um usuário por empresa parceira (`Usuario.parceiraId`); só vê a tela "Fechamento" e
  confirma o fechamento mensal da empresa dele.

## Modelo do cronograma/escopo (o coração do sistema)

- Projeto tem `escopoAtividades: EscopoAtividade[]` — **lista plana ordenada** com `nivel` (0 = raiz). Grupos nunca têm
  duração própria: ela é a soma das folhas. Helpers em `src/lib/escopo.ts`. O **ID da atividade** é o que liga previsto
  ao realizado (apontamentos guardam `atividadesRealizadas: id[]`), por isso os IDs precisam ser preservados.
- Importadores: `importarEscopo.ts` (escopo-padrão), `importarCronograma.ts` (tabular) e `importarCronogramaGantt.ts`
  (planilha "Nome da Tarefa", hierarquia pelas fórmulas de soma; só é Gantt se a coluna de tempo tiver fórmulas).
  Colunas lidas: Nome/Atividade, **Nível** (hierarquia de N níveis), Duração, Unidade, **Início, Fim, Período, Recurso**.
- **Versões do cronograma** (`versoesCronograma`, subcoleção do projeto): cada importação é uma versão com **observação
  obrigatória**. `versaoCronograma.ts` casa as atividades novas com as atuais (mesmo caminho Fase›Grupo›Tarefa ou nome
  único) para manter os IDs; `preservarRealizado` mantém data/período/recurso das tarefas já concluídas e mantém no
  cronograma (marcadas "realizada em versão anterior") as tarefas com horas que saíram do arquivo.
- **Progresso**: fração da folha = finalizada ? 1 : min(1, horas/previstas); apontamento tem flag "em andamento /
  finalizado"; percentual do projeto = média das folhas (por contagem). Código em `progressoEscopo.ts`/`dashboardCalc.ts`.

## Agenda e Mapa de Alocação (`src/lib/cronograma.ts`, `agendaPrevista.ts`)

- Um **turno = 4h** (manhã 08–12, tarde 13–17). **O que o cronograma diz é o que vale — nunca estender pela duração.**
  Com Período: tarefa de um dia ocupa 1 turno (máx. 4h); tarefa Início→Fim é **dividida entre os dias** (primeiro turno
  no Início, último no Fim, intermediários nos dias úteis seguintes). Sem Período: encaixa em sequência no dia do
  recurso. Mais de 4h no mesmo turno/recurso = "sobreposição" (só alerta; consertar = corrigir o cronograma).
- Feriados são ignorados de propósito ("às vezes trabalhamos em feriados"). Fim de semana só é pulado ao dividir tarefas.
- **Mapa de Alocação** (admin/coordenador): manhã/tarde por dia, ocupação, realizado, "Quem está livre?". **Previsto**
  aparece no calendário do consultor e na aba Apontamento → Horas previstas → "Agenda do cronograma" como
  **sobreposição calculada na hora (não grava evento)**. **Cada consultor vê só a própria agenda.**
- Não existe mais "Distribuir agenda" (foi removido): consultor/data/período vêm da planilha.

## Fechamento mensal do financeiro (Fase 1 pronta)

Fluxo **por parceira** (cada uma tem botões próprios; próprios não têm etapas, só relatório): rascunho → em revisão
(valores congelados) → fechado → faturamento liberado (`FechamentoParceiro.etapa`; `etapaDaParceira` cobre docs antigos
do mês inteiro). Coleções: `fechamentos/{YYYY-MM}` (só a subcoleção `historico`, auditoria com quem/quando/motivo/parceira),
`fechamentoItens` (detalhe por consultor) e `fechamentoParceiros/{YYYY-MM_parceiraId}` (um por empresa parceira, com os
recursos dentro). Após "Liberar faturamento" da parceira, **cada consultor terceiro confirma/contesta as próprias horas**
no login dele (perfil `consultor`, tela `/meu-fechamento`, só aparece se ele tiver item liberado); o status fica em
`FechamentoParceiro.statusConsultores` (recursoId → status) e a parceira só segue para a NF quando todos confirmam
(`confirmacaoDaParceira`); uma contestação trava até o Financeiro reabrir/ajustar. O Financeiro pode "Confirmar em nome"
de quem não tem acesso. O responsável da parceira só acompanha e envia a NF (docs antigos ainda usam ciência + confirmação dele).
Divergências: bloqueantes (lançamentos sem aprovação) e alertas. O prazo "dia 1 a 10 do mês seguinte" é só referência
visual: **não existe regra de data limite**. Lógica em `src/lib/fechamento.ts` e `fechamentoDb.ts`; tela em
`src/app/financeiro/fechamentos`.
**Fases 2 e 3 (prontas)**: depois de confirmar os valores, o responsável da parceira envia a **nota fiscal** (número, data,
valor, PDF no Firebase Storage) — o financeiro valida (checkbox de conferência; valor diferente exige justificativa) ou
rejeita com motivo; histórico da NF em `historicoNf`. Só com a NF validada dá para **registrar pagamento** (valor, data,
TED/boleto/cheque, referência, comprovante); reconciliação alerta se pago ≠ calculado; "Extrato" por parceira; filtros
por tipo e situação; exportações "NFs pendentes" e "Pagamentos atrasados" (vencimento = `calcularVencimentoFechamento`).
Lógica em `fechamentoNf.ts`/`fechamentoNfDb.ts`/`arquivosFechamento.ts`. **Arquivos SEM Firebase Storage** (o Storage exige
plano pago e o usuário quer tudo gratuito): PDFs/comprovantes ficam no Firestore, divididos em partes base64
(`arquivosFechamento/{id}/partes`), limite de **3 MB** por arquivo. Não reintroduzir o Storage.

## Outros pontos de negócio

- **OS (ordem de serviço)**: PDF gerado a partir de um apontamento; o consultor marca os participantes (principais
  envolvidos do projeto), que entram numa lista acima das atividades; sem campo de assinatura; texto fixo de aprovação
  automática em 48h. Código em `src/lib/ordemServico.ts`.
- Cadastro de projeto permite importar o cronograma já na criação (vira a versão 1); escopo-padrão é opção secundária.
- Apontamentos só contam nos cálculos quando **aprovados**. Consultor lança, coordenador aprova.

## Armadilhas técnicas

- Firestore rejeita `undefined`: limpar payloads com `JSON.parse(JSON.stringify(x))` antes de gravar.
- Consultas com `useCollection` precisam ser compatíveis com as regras (ex.: apontamentos filtrados por `recursoId` ou
  `projetoId` conforme o perfil). Alterar regra e consulta juntos.
- Lint do React Compiler (`react-hooks/preserve-manual-memoization`) é sensível a `useMemo` com dependências parciais.
- No Windows/Git Bash, heredocs com aspas simples podem quebrar: para scripts temporários, gravar o arquivo e rodar.
- Testes ad-hoc: páginas temporárias `src/app/zz-teste-*` e scripts `zz-*.mjs` na raiz — **sempre apagar antes de
  commitar** (`ls | grep zz`).
- Zerar dados de produção (uso único, ainda não confirmado pelo usuário): `scripts-locais/zerar-dados.mjs`
  (mantém usuários, clientes, recursos, tipos de documento e parceiras; faz backup completo antes; pede frase de confirmação).
