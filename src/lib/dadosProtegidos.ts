"use client";

import { useMemo } from "react";
import { doc, setDoc, type WriteBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/lib/useCollection";
import type { ContatoFaturamento, Financeiro, Projeto, Recurso, Usuario } from "@/types";

/**
 * Dados sensíveis ficam fora dos documentos que todo usuário logado lê (as regras do Firestore liberam o documento
 * inteiro, nunca um campo só):
 *   projetosFinanceiro/{projetoId} -> { financeiro, contatoFaturamento }   (só administrador e financeiro)
 *   recursosValores/{recursoId}    -> { valorHora }                         (só administrador e financeiro)
 * As telas continuam recebendo `Projeto` e `Recurso` completos: os hooks abaixo juntam a parte pública com a protegida
 * para quem pode ver. Para os demais perfis, o financeiro vem vazio e o valor/hora vem 0.
 *
 * Transição: enquanto a migração não roda, os campos ainda podem estar no documento antigo (projetos/recursos) e são
 * usados como reserva. Depois da migração eles deixam de existir lá.
 */

export const COLECAO_FINANCEIRO_PROJETO = "projetosFinanceiro";
export const COLECAO_VALOR_RECURSO = "recursosValores";

export interface ProjetoFinanceiroDoc {
  id: string;
  financeiro?: Financeiro;
  contatoFaturamento?: ContatoFaturamento | null;
}

export interface RecursoValorDoc {
  id: string;
  valorHora?: number;
}

export const FINANCEIRO_VAZIO: Financeiro = { tipoFaturamento: "apontamento_horas", valorTotal: 0, numeroParcelas: 0, parcelas: [] };

/** Quem enxerga valores (financeiro dos projetos e valor/hora dos recursos). */
export function podeVerDadosFinanceiros(usuario: Pick<Usuario, "perfil"> | null | undefined): boolean {
  return usuario?.perfil === "administrador" || usuario?.perfil === "financeiro";
}

const limpar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Projetos com o financeiro e o contato de faturamento (para quem pode ver). Mesma ordem/consulta de antes. */
export function useProjetos() {
  const { usuario } = useAuth();
  const privilegiado = podeVerDadosFinanceiros(usuario);
  const { data: projetos, loading, erro } = useCollection<Projeto>("projetos");
  const { data: protegidos } = useCollection<ProjetoFinanceiroDoc>(COLECAO_FINANCEIRO_PROJETO, [], privilegiado, [privilegiado]);

  const data = useMemo(() => {
    const porId = new Map(privilegiado ? protegidos.map((p) => [p.id, p]) : []);
    return projetos.map((p): Projeto => {
      const extra = porId.get(p.id);
      return {
        ...p,
        financeiro: (privilegiado ? (extra?.financeiro ?? p.financeiro) : p.financeiro) ?? FINANCEIRO_VAZIO,
        contatoFaturamento: privilegiado
          ? extra && "contatoFaturamento" in extra
            ? (extra.contatoFaturamento ?? null)
            : (p.contatoFaturamento ?? null)
          : (p.contatoFaturamento ?? null),
      };
    });
  }, [projetos, protegidos, privilegiado]);

  return { data, loading, erro };
}

/** Recursos com o valor/hora (para quem pode ver; para os demais, 0). Mesma ordem/consulta de antes. */
export function useRecursos() {
  const { usuario } = useAuth();
  const privilegiado = podeVerDadosFinanceiros(usuario);
  const { data: recursos, loading, erro } = useCollection<Recurso>("recursos");
  const { data: valores } = useCollection<RecursoValorDoc>(COLECAO_VALOR_RECURSO, [], privilegiado, [privilegiado]);

  const data = useMemo(() => {
    const porId = new Map(privilegiado ? valores.map((v) => [v.id, v.valorHora]) : []);
    return recursos.map((r): Recurso => ({
      ...r,
      valorHora: (privilegiado ? (porId.get(r.id) ?? r.valorHora) : r.valorHora) ?? 0,
    }));
  }, [recursos, valores, privilegiado]);

  return { data, loading, erro };
}

/** Grava o financeiro e/ou o contato de faturamento do projeto (só o que vier preenchido). */
export async function salvarDadosFinanceirosProjeto(
  projetoId: string,
  dados: { financeiro?: Financeiro; contatoFaturamento?: ContatoFaturamento | null },
  lote?: WriteBatch
) {
  const ref = doc(db, COLECAO_FINANCEIRO_PROJETO, projetoId);
  const payload = limpar({ ...dados, atualizadoEm: Date.now() });
  if (lote) lote.set(ref, payload, { merge: true });
  else await setDoc(ref, payload, { merge: true });
}

/** Grava o valor/hora do recurso. */
export async function salvarValorHoraRecurso(recursoId: string, valorHora: number, lote?: WriteBatch) {
  const ref = doc(db, COLECAO_VALOR_RECURSO, recursoId);
  const payload = { valorHora, atualizadoEm: Date.now() };
  if (lote) lote.set(ref, payload, { merge: true });
  else await setDoc(ref, payload, { merge: true });
}
