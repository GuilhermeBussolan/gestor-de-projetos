"use client";

import { where } from "firebase/firestore";
import { useCollection } from "@/lib/useCollection";
import { useDocumentos } from "@/lib/useDocumentos";
import { ehResponsavelNf, situacaoDaParceira } from "@/lib/fechamentoNf";
import type { EmpresaParceira, FechamentoParceiro, ItemFechamento, Perfil, Usuario } from "@/types";

/** Quem confere as próprias horas no "Meu fechamento": o consultor e o coordenador terceiros (com recurso vinculado). */
export const PERFIS_MEU_FECHAMENTO: Perfil[] = ["consultor", "coordenador"];

/**
 * Os fechamentos já liberados do próprio consultor (terceiro), para ele conferir e confirmar as horas com o login dele,
 * e quantos ainda esperam a resposta dele. Só abre a escuta para consultor/coordenador com recurso vinculado; recurso
 * interno nunca tem item de fechamento, então a lista dele fica sempre vazia.
 *
 * Quando o consultor é o contato 1 da parceira (quem envia a NF da empresa), também traz o fechamento da parceira de
 * cada mês, para ele acompanhar a confirmação dos colegas e enviar a nota fiscal.
 */
export function useMeuFechamento(usuario: Usuario | null) {
  const ativo = !!usuario && PERFIS_MEU_FECHAMENTO.includes(usuario.perfil) && !!usuario.recursoId;
  const { data, loading, erro } = useCollection<ItemFechamento>(
    "fechamentoItens",
    [where("recursoId", "==", usuario?.recursoId ?? ""), where("liberado", "==", true)],
    ativo,
    [ativo, usuario?.recursoId]
  );
  const { data: parceiras } = useCollection<EmpresaParceira>("parceiras", [], ativo, [ativo]);
  const itens = ativo ? [...data].sort((a, b) => b.mesAno.localeCompare(a.mesAno)) : [];

  const souResponsavelNf = (parceiraId: string | null) =>
    !!parceiraId && ehResponsavelNf(parceiras.find((p) => p.id === parceiraId), usuario?.email);
  const fechamentosParceira = useDocumentos<FechamentoParceiro>(
    "fechamentoParceiros",
    itens.filter((i) => souResponsavelNf(i.parceiraId)).map((i) => `${i.mesAno}_${i.parceiraId}`)
  );

  const confirmacoesPendentes = itens.filter((i) => i.confirmacao.status === "pendente").length;
  const nfsPendentes = fechamentosParceira.filter((f) => {
    const s = situacaoDaParceira(f);
    return s === "aguardando_nf" || s === "nf_rejeitada";
  }).length;

  return {
    itens,
    parceiras,
    fechamentosParceira,
    souResponsavelNf,
    confirmacoesPendentes,
    nfsPendentes,
    pendentes: confirmacoesPendentes + nfsPendentes,
    loading,
    erro,
  };
}
