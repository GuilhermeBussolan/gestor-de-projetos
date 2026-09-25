import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { statusEfetivo } from "@/lib/statusHora";
import type { EventoCalendario, Parcela, Projeto } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "80h", "80,5h", "80,25h" — horas decimais sem zeros sobrando. */
export function formatarHorasDecimais(horas: number): string {
  return `${horas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}h`;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-09" -> "set/2026". */
export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${MESES[Number(m) - 1] ?? m}/${ano}`;
}

/** Horas APROVADAS do projeto no mês (todos os recursos). Suporta horas parciais (80,5h). */
export function horasApontadasNoMes(eventos: EventoCalendario[], projetoId: string, mes: string): number {
  const total = eventos
    .filter((e) => e.projetoId === projetoId && e.data.startsWith(mes) && statusEfetivo(e) === "aprovado")
    .reduce((s, e) => s + (e.totalHoras ?? 0), 0);
  return Math.round(total * 100) / 100;
}

/** Horas × valor hora, arredondado em centavos. */
export function valorDoBancoDeHoras(horas: number, valorHora: number): number {
  return Math.round(horas * valorHora * 100) / 100;
}

/** Ex.: "80h × R$ 100,00 = R$ 8.000,00". */
export function resumoBancoDeHoras(horas: number, valorHora: number): string {
  return `${formatarHorasDecimais(horas)} × ${moeda(valorHora)} = ${moeda(valorDoBancoDeHoras(horas, valorHora))}`;
}

/** A parcela (não cancelada) que já foi gerada para o mês, se houver. */
export function parcelaDoMes(projeto: Pick<Projeto, "financeiro">, mes: string): Parcela | undefined {
  return (projeto.financeiro?.parcelas ?? []).find((p) => p.periodoReferencia === mes && p.status !== "CANCELADO");
}

/**
 * Gera a parcela do banco de horas do mês, com o valor sugerido (ou o editado): entra na lista de parcelas
 * do projeto como "Aguardando" e segue o fluxo normal (liberado, faturado, recebido).
 */
export async function gerarParcelaBancoDeHoras({
  projeto,
  mes,
  horas,
  valorHora,
  valor,
}: {
  projeto: Projeto;
  mes: string;
  horas: number;
  valorHora: number;
  valor: number;
}) {
  const financeiro = projeto.financeiro;
  const parcelas = financeiro?.parcelas ?? [];
  const numero = parcelas.reduce((m, p) => Math.max(m, p.numero), 0) + 1;
  const nova: Parcela = {
    numero,
    descricao: `Banco de horas — ${rotuloMes(mes)} (${resumoBancoDeHoras(horas, valorHora)})`,
    valor,
    status: "AGUARDANDO",
    periodoReferencia: mes,
    horasApontadas: horas,
    valorHoraAplicado: valorHora,
  };
  const novas = [...parcelas, nova];
  // Só o campo "financeiro": é o único que o perfil financeiro pode gravar no projeto (regras do Firestore).
  await updateDoc(doc(db, "projetos", projeto.id), {
    financeiro: JSON.parse(JSON.stringify({ ...financeiro, numeroParcelas: novas.length, parcelas: novas })),
  });
}
