import { salvarDadosFinanceirosProjeto } from "@/lib/dadosProtegidos";
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
  // Evita datas digitadas errado (ex.: ano "0022" em vez de 2026), que tiram a parcela dos relatórios por mês.
  const anoPlausivel = (iso?: string | null) => !iso || /^20\d\d-/.test(iso);
  if (!anoPlausivel(dados.dataLiberacaoIso) || !anoPlausivel(dados.dataRecebimento) || !anoPlausivel(dados.dataCancelamento)) {
    return "Confira a data: o ano precisa estar entre 2000 e 2099.";
  }
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

/** Aplica uma troca de status numa lista de parcelas (validando antes) e devolve a lista nova — sem gravar. */
function aplicarStatus(
  parcelasAtuais: Parcela[],
  numero: number,
  status: StatusParcela,
  dados: DadosStatusParcela,
  usuario?: Usuario
): Parcela[] {
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
  return parcelas;
}

export async function alterarStatusParcela(
  projeto: Projeto,
  numero: number,
  status: StatusParcela,
  dados: DadosStatusParcela = {},
  usuario?: Usuario
) {
  const parcelas = aplicarStatus(projeto.financeiro.parcelas, numero, status, dados, usuario);
  await salvarDadosFinanceirosProjeto(projeto.id, { financeiro: { ...projeto.financeiro, parcelas } });
}

export interface MudancaEmLote {
  projeto: Projeto;
  numero: number;
  status: StatusParcela;
  dados: DadosStatusParcela;
}

/**
 * Troca o status de várias parcelas de uma vez (recebimento ou NF em lote). As parcelas do mesmo projeto são gravadas
 * juntas, numa escrita só, para uma não apagar a outra. Devolve quantas deram certo e os erros (por projeto), sem
 * parar no primeiro.
 */
export async function alterarStatusEmLote(mudancas: MudancaEmLote[], usuario?: Usuario): Promise<{ ok: number; erros: string[] }> {
  const porProjeto = new Map<string, MudancaEmLote[]>();
  for (const m of mudancas) porProjeto.set(m.projeto.id, [...(porProjeto.get(m.projeto.id) ?? []), m]);
  let ok = 0;
  const erros: string[] = [];
  for (const lista of porProjeto.values()) {
    const projeto = lista[0].projeto;
    try {
      let parcelas = projeto.financeiro.parcelas;
      for (const m of [...lista].sort((a, b) => a.numero - b.numero)) parcelas = aplicarStatus(parcelas, m.numero, m.status, m.dados, usuario);
      await salvarDadosFinanceirosProjeto(projeto.id, { financeiro: { ...projeto.financeiro, parcelas } });
      ok += lista.length;
    } catch (err) {
      erros.push(`Proposta ${projeto.codigoProposta}: ${err instanceof Error ? err.message : "não foi possível salvar"}`);
    }
  }
  return { ok, erros };
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
  await salvarDadosFinanceirosProjeto(projeto.id, { financeiro: { ...projeto.financeiro, parcelas } });
}
