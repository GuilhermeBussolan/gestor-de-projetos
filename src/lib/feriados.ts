import { addDays, format, subDays } from "date-fns";

/** Domingo de Páscoa pelo algoritmo de Butcher/Meeus (calendário gregoriano). */
function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

/** Feriados nacionais fixos + móveis (Carnaval, Sexta-feira Santa, Corpus Christi). */
export function feriadosNacionais(ano: number): Set<string> {
  const p = pascoa(ano);
  const datas = [
    new Date(ano, 0, 1), // Confraternização Universal
    new Date(ano, 3, 21), // Tiradentes
    new Date(ano, 4, 1), // Dia do Trabalho
    new Date(ano, 8, 7), // Independência
    new Date(ano, 9, 12), // Nossa Senhora Aparecida
    new Date(ano, 10, 2), // Finados
    new Date(ano, 10, 15), // Proclamação da República
    new Date(ano, 10, 20), // Consciência Negra
    new Date(ano, 11, 25), // Natal
    subDays(p, 47), // Carnaval (terça-feira)
    subDays(p, 2), // Sexta-feira Santa
    addDays(p, 60), // Corpus Christi
  ];
  return new Set(datas.map((d) => format(d, "yyyy-MM-dd")));
}

export function eDiaUtil(data: Date): boolean {
  const diaSemana = data.getDay();
  if (diaSemana === 0 || diaSemana === 6) return false;
  return !feriadosNacionais(data.getFullYear()).has(format(data, "yyyy-MM-dd"));
}

export function proximoDiaUtil(data: Date): Date {
  let d = data;
  while (!eDiaUtil(d)) {
    d = addDays(d, 1);
  }
  return d;
}

/** Vencimento do fechamento de uma competência (mesAno "YYYY-MM"): dia 28 do mês seguinte, adiado para o próximo dia útil. */
export function calcularVencimentoFechamento(mesAno: string): Date {
  const [ano, mes] = mesAno.split("-").map(Number);
  return proximoDiaUtil(new Date(ano, mes, 28));
}
