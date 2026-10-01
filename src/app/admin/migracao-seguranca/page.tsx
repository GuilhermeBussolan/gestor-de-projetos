"use client";

// Tela de USO ÚNICO da Fase 2 de segurança: tira os dados sensíveis dos documentos que todo usuário logado lê.
//   projetos/{id}.financeiro e .contatoFaturamento -> projetosFinanceiro/{id}
//   recursos/{id}.valorHora                        -> recursosValores/{id}
// Antes de mover, baixa um backup completo (JSON) no computador do administrador. Pode ser rodada de novo sem risco:
// só mexe no que ainda estiver no lugar antigo, e não sobrescreve o que já foi gravado no lugar novo.
// Remover esta tela depois que a migração estiver concluída em produção.

import { useState } from "react";
import { deleteField, doc, writeBatch } from "firebase/firestore";
import { saveAs } from "file-saver";
import { ShieldCheck } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { COLECAO_FINANCEIRO_PROJETO, COLECAO_VALOR_RECURSO, type ProjetoFinanceiroDoc, type RecursoValorDoc } from "@/lib/dadosProtegidos";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";

type DocBruto = { id: string } & Record<string, unknown>;

const MAX_OPERACOES_POR_LOTE = 400;
const temCampo = (d: DocBruto, campo: string) => Object.prototype.hasOwnProperty.call(d, campo);

function MigracaoContent() {
  // Leitura "crua" (sem juntar com a parte protegida) e sem ordenação, para pegar até documentos sem createdAt.
  const { data: projetos, loading: carregandoProjetos } = useCollection<DocBruto>("projetos", []);
  const { data: recursos, loading: carregandoRecursos } = useCollection<DocBruto>("recursos", []);
  const { data: financeirosNovos } = useCollection<ProjetoFinanceiroDoc>(COLECAO_FINANCEIRO_PROJETO, []);
  const { data: valoresNovos } = useCollection<RecursoValorDoc>(COLECAO_VALOR_RECURSO, []);

  const [backupFeito, setBackupFeito] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const [resultado, setResultado] = useState<string>("");
  const [erro, setErro] = useState("");

  const projetosPendentes = projetos.filter((p) => temCampo(p, "financeiro") || temCampo(p, "contatoFaturamento"));
  const recursosPendentes = recursos.filter((r) => temCampo(r, "valorHora"));
  const carregando = carregandoProjetos || carregandoRecursos;
  const nadaAMigrar = !carregando && projetosPendentes.length === 0 && recursosPendentes.length === 0;

  function baixarBackup() {
    const conteudo = {
      geradoEm: new Date().toISOString(),
      projetos,
      recursos,
      [COLECAO_FINANCEIRO_PROJETO]: financeirosNovos,
      [COLECAO_VALOR_RECURSO]: valoresNovos,
    };
    const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    saveAs(new Blob([JSON.stringify(conteudo, null, 2)], { type: "application/json" }), `backup-antes-migracao-seguranca-${carimbo}.json`);
    setBackupFeito(true);
  }

  async function migrar() {
    setMigrando(true);
    setErro("");
    setResultado("");
    try {
      const novosFin = new Map(financeirosNovos.map((d) => [d.id, d]));
      const novosVal = new Map(valoresNovos.map((d) => [d.id, d]));
      // Cada item vira 2 operações (grava no lugar novo + apaga do antigo).
      const operacoes: ((lote: ReturnType<typeof writeBatch>) => void)[] = [];

      for (const p of projetosPendentes) {
        const existente = novosFin.get(p.id);
        const novo: Record<string, unknown> = {};
        // O que já foi gravado no lugar novo (depois da atualização do sistema) é mais recente: não sobrescreve.
        if (temCampo(p, "financeiro") && !existente?.financeiro) novo.financeiro = p.financeiro;
        if (temCampo(p, "contatoFaturamento") && !(existente && "contatoFaturamento" in existente)) novo.contatoFaturamento = p.contatoFaturamento ?? null;
        operacoes.push((lote) => {
          if (Object.keys(novo).length > 0) {
            lote.set(doc(db, COLECAO_FINANCEIRO_PROJETO, p.id), JSON.parse(JSON.stringify({ ...novo, atualizadoEm: Date.now() })), { merge: true });
          }
          lote.update(doc(db, "projetos", p.id), { financeiro: deleteField(), contatoFaturamento: deleteField() });
        });
      }
      for (const r of recursosPendentes) {
        const existente = novosVal.get(r.id);
        operacoes.push((lote) => {
          if (existente?.valorHora === undefined) {
            lote.set(doc(db, COLECAO_VALOR_RECURSO, r.id), { valorHora: Number(r.valorHora) || 0, atualizadoEm: Date.now() }, { merge: true });
          }
          lote.update(doc(db, "recursos", r.id), { valorHora: deleteField() });
        });
      }

      const porLote = Math.floor(MAX_OPERACOES_POR_LOTE / 2);
      for (let i = 0; i < operacoes.length; i += porLote) {
        const lote = writeBatch(db);
        operacoes.slice(i, i + porLote).forEach((op) => op(lote));
        await lote.commit();
      }
      setResultado(
        `Migração concluída: ${projetosPendentes.length} projeto(s) e ${recursosPendentes.length} recurso(s) tiveram os dados sensíveis movidos para as coleções protegidas.`
      );
    } catch (err) {
      console.error("Erro na migração:", err);
      setErro(
        "A migração parou no meio. Nada se perde: o que já foi movido está no lugar novo e o resto continua no antigo. Confira se as regras do Firestore (parte 1) foram publicadas e clique em Migrar de novo."
      );
    } finally {
      setMigrando(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">
        <ShieldCheck size={22} className="text-brand-accent" />
        Migração de segurança (uso único)
      </h1>
      <p className="mb-5 text-sm text-brand-muted">
        Move o financeiro e o contato de faturamento dos projetos, e o valor/hora dos recursos, para coleções que só o administrador e o financeiro
        leem. Antes de migrar, baixe o backup.
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold tracking-[.08em] text-brand-faint uppercase">Projetos a migrar</p>
          <p className="text-[26px] font-extrabold text-brand-navy-2">{carregando ? "…" : projetosPendentes.length}</p>
          <p className="text-[12px] text-brand-muted">de {projetos.length} projetos</p>
        </div>
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold tracking-[.08em] text-brand-faint uppercase">Recursos a migrar</p>
          <p className="text-[26px] font-extrabold text-brand-navy-2">{carregando ? "…" : recursosPendentes.length}</p>
          <p className="text-[12px] text-brand-muted">de {recursos.length} recursos</p>
        </div>
      </div>

      {nadaAMigrar ? (
        <p className="rounded-xl bg-[#e3f5ea] p-4 text-[13.5px] font-semibold text-[#15754c]">
          Nada a migrar: os dados sensíveis já estão todos nas coleções protegidas. Pode publicar as regras do Firestore (parte 2).
        </p>
      ) : (
        <div className="space-y-3 rounded-2xl border border-brand-border bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={baixarBackup} disabled={carregando}>
              1. Baixar backup
            </Button>
            {backupFeito && <span className="text-[12.5px] font-semibold text-[#15754c]">Backup baixado — guarde o arquivo.</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={migrar} disabled={!backupFeito || migrando || carregando}>
              {migrando ? "Migrando..." : "2. Migrar"}
            </Button>
            {!backupFeito && <span className="text-[12.5px] text-brand-faint">Baixe o backup primeiro.</span>}
          </div>
        </div>
      )}

      {resultado && <p className="mt-4 rounded-md bg-[#e3f5ea] p-3 text-[13px] font-semibold text-[#15754c]">{resultado}</p>}
      {erro && <p className="mt-4 rounded-md bg-[#fdeceb] p-3 text-[13px] font-semibold text-[#b5392a]">{erro}</p>}
    </div>
  );
}

export default function MigracaoSegurancaPage() {
  return (
    <ProtectedPage perfis={["administrador"]}>
      <MigracaoContent />
    </ProtectedPage>
  );
}
