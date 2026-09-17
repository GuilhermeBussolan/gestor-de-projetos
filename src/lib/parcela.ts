import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Parcela, Projeto, StatusParcela } from "@/types";

export interface DadosStatusParcela {
  notaFiscal?: string;
  dataRecebimento?: string;
  dataCancelamento?: string;
  motivoCancelamento?: string;
}

/**
 * Confere se a troca de status pode prosseguir com os dados informados.
 * Retorna uma mensagem de erro (e nada é salvo) ou null quando está tudo certo.
 */
export function validarDadosStatusParcela(
  status: StatusParcela,
  dados: DadosStatusParcela
): string | null {
  if (status === "FATURADO" && !dados.notaFiscal?.trim()) {
    return "Informe a nota fiscal para marcar como Faturado.";
  }
  if (status === "RECEBIDO" && !dados.dataRecebimento) {
    return "Informe a data de recebimento.";
  }
  if (status === "CANCELADO" && !dados.dataCancelamento) {
    return "Informe a data de cancelamento.";
  }
  if (status === "CANCELADO" && !dados.motivoCancelamento?.trim()) {
    return "Informe o motivo do cancelamento.";
  }
  return null;
}

export async function alterarStatusParcela(
  projeto: Projeto,
  numero: number,
  status: StatusParcela,
  dados: DadosStatusParcela = {}
) {
  const erro = validarDadosStatusParcela(status, dados);
  if (erro) throw new Error(erro);

  const parcelas = projeto.financeiro.parcelas.map((p): Parcela => {
    if (p.numero !== numero) return p;
    const atualizado: Parcela = { ...p, status };
    if (status === "LIBERADO") {
      atualizado.dataLiberacao = Date.now();
    }
    if (status === "FATURADO") {
      atualizado.notaFiscal = dados.notaFiscal!.trim();
    }
    if (status === "RECEBIDO") {
      atualizado.dataRecebimento = dados.dataRecebimento;
    }
    if (status === "CANCELADO") {
      atualizado.dataCancelamento = dados.dataCancelamento;
      atualizado.motivoCancelamento = dados.motivoCancelamento!.trim();
    }
    return atualizado;
  });
  await updateDoc(doc(db, "projetos", projeto.id), {
    financeiro: { ...projeto.financeiro, parcelas },
  });
}
