import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Parcela, Projeto, StatusParcela, Usuario } from "@/types";

export interface DadosStatusParcela {
  notaFiscal?: string;
  /** Data informada ao liberar (YYYY-MM-DD). Ausente/atual = hoje. */
  dataLiberacaoIso?: string;
  dataRecebimento?: string;
  dataCancelamento?: string;
  motivoCancelamento?: string;
}

function dataIsoParaTimestamp(iso: string): number {
  // Meio-dia local evita cair no dia anterior por fuso ao converter de volta para data.
  return new Date(`${iso}T12:00:00`).getTime();
}

function diasEntre(a: string, b: string): number {
  return Math.round((dataIsoParaTimestamp(b) - dataIsoParaTimestamp(a)) / 86_400_000);
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Intervalo entre as datas PREVISTAS ORIGINAIS da 1ª e 2ª parcela — a base do cálculo de 1.1. */
export function intervaloOriginalDias(parcelas: Parcela[]): number | null {
  const p1 = parcelas.find((p) => p.numero === 1)?.dataPrevistaOriginal;
  const p2 = parcelas.find((p) => p.numero === 2)?.dataPrevistaOriginal;
  if (!p1 || !p2) return null;
  return diasEntre(p1, p2);
}

/** Há alguma parcela anterior a `numero` ainda "Aguardando" (não liberada)? */
export function existeParcelaAnteriorPendente(parcelas: Parcela[], numero: number): boolean {
  return parcelas.some((p) => p.numero < numero && p.status === "AGUARDANDO");
}

/**
 * Recalcula a data prevista das parcelas futuras (ainda "Aguardando"), ancorando na data de
 * liberação informada e mantendo o intervalo original entre parcelas. Não altera parcelas já
 * resolvidas (liberadas, faturadas, recebidas ou canceladas) nem a parcela que está sendo
 * liberada agora.
 */
export function recalcularDatasFuturas(
  parcelas: Parcela[],
  numeroLiberada: number,
  dataLiberacaoIso: string
): Parcela[] {
  const intervalo = intervaloOriginalDias(parcelas);
  if (intervalo === null) return parcelas;
  return parcelas.map((p) => {
    if (p.numero <= numeroLiberada || p.status !== "AGUARDANDO") return p;
    return { ...p, dataPrevista: somarDias(dataLiberacaoIso, intervalo * (p.numero - numeroLiberada)) };
  });
}

/** Prévia das novas datas, para mostrar antes de confirmar (mesmo cálculo de `recalcularDatasFuturas`). */
export function preverDatasFuturas(
  parcelas: Parcela[],
  numeroLiberada: number,
  dataLiberacaoIso: string
): { numero: number; descricao: string; dataAnterior: string | null; dataNova: string }[] {
  if (!dataLiberacaoIso) return [];
  const recalculadas = recalcularDatasFuturas(parcelas, numeroLiberada, dataLiberacaoIso);
  return recalculadas
    .filter((p, i) => p.dataPrevista && p.dataPrevista !== parcelas[i].dataPrevista)
    .map((p) => ({
      numero: p.numero,
      descricao: p.descricao ? p.descricao : `Parcela ${p.numero}`,
      dataAnterior: parcelas.find((a) => a.numero === p.numero)?.dataPrevista ?? null,
      dataNova: p.dataPrevista!,
    }));
}

/**
 * Confere se a troca de status pode prosseguir com os dados informados.
 * Retorna uma mensagem de erro (e nada é salvo) ou null quando está tudo certo.
 */
export function validarDadosStatusParcela(
  status: StatusParcela,
  dados: DadosStatusParcela,
  parcelas: Parcela[],
  numero: number
): string | null {
  if (status === "LIBERADO") {
    if (existeParcelaAnteriorPendente(parcelas, numero)) {
      return "Existe uma parcela anterior ainda aguardando liberação. Libere as parcelas em ordem.";
    }
    if (!dados.dataLiberacaoIso) {
      return "Informe a data de liberação.";
    }
  }
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
  dados: DadosStatusParcela = {},
  usuario?: Usuario
) {
  const parcelasAtuais = projeto.financeiro.parcelas;
  const erro = validarDadosStatusParcela(status, dados, parcelasAtuais, numero);
  if (erro) throw new Error(erro);

  let parcelas = parcelasAtuais.map((p): Parcela => {
    if (p.numero !== numero) return p;
    const atualizado: Parcela = { ...p, status };
    if (status === "LIBERADO") {
      atualizado.dataLiberacao = dataIsoParaTimestamp(dados.dataLiberacaoIso!);
      atualizado.liberadoPor = usuario ? { uid: usuario.uid, nome: usuario.nomeCompleto } : null;
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

  if (status === "LIBERADO") {
    parcelas = recalcularDatasFuturas(parcelas, numero, dados.dataLiberacaoIso!);
  }

  await updateDoc(doc(db, "projetos", projeto.id), {
    financeiro: { ...projeto.financeiro, parcelas },
  });
}

/** Previsão de faturamento de um marco (1.2) — editável enquanto a parcela está Aguardando. */
export async function atualizarPrevisaoFaturamentoMarco(
  projeto: Projeto,
  numero: number,
  dataPrevisaoFaturamento: string,
  usuario: Usuario
) {
  const parcelas = projeto.financeiro.parcelas.map((p): Parcela =>
    p.numero === numero
      ? {
          ...p,
          dataPrevisaoFaturamento: dataPrevisaoFaturamento || null,
          previsaoAtualizadaEm: Date.now(),
          previsaoAtualizadaPor: usuario.nomeCompleto,
        }
      : p
  );
  await updateDoc(doc(db, "projetos", projeto.id), {
    financeiro: { ...projeto.financeiro, parcelas },
  });
}
