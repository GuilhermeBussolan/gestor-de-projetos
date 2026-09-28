import { HORARIO_PERIODO, HORAS_POR_TURNO } from "@/lib/cronograma";
import type { BloqueioAgenda, PeriodoDia, Usuario } from "@/types";

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

/** O bloqueio vale nesse dia (qualquer horário)? */
export function bloqueioNoDia(b: BloqueioAgenda, data: string): boolean {
  return b.dataInicio <= data && data <= b.dataFim;
}

/** Os bloqueios do recurso que caem dentro do horário pedido (um lançamento aí não é permitido). */
export function bloqueiosQueConflitam(
  bloqueios: BloqueioAgenda[],
  recursoId: string,
  data: string,
  horaInicio: string,
  horaFim: string
): BloqueioAgenda[] {
  return bloqueios.filter((b) => {
    if (b.recursoId !== recursoId || !bloqueioNoDia(b, data)) return false;
    if (b.diaInteiro || !b.horaInicio || !b.horaFim) return true;
    return horaInicio < b.horaFim && b.horaInicio < horaFim;
  });
}

/** Horas do turno (manhã/tarde de 4h) tomadas por bloqueios do recurso nesse dia. */
export function horasBloqueadasNoTurno(bloqueios: BloqueioAgenda[], recursoId: string, data: string, periodo: PeriodoDia): number {
  const { horaInicio, horaFim } = HORARIO_PERIODO[periodo];
  const doRecurso = bloqueios.filter((b) => b.recursoId === recursoId && bloqueioNoDia(b, data));
  if (doRecurso.some((b) => b.diaInteiro)) return HORAS_POR_TURNO;
  // Soma por minuto para não contar duas vezes bloqueios que se sobrepõem.
  const ocupados = new Set<number>();
  for (const b of doRecurso) {
    if (!b.horaInicio || !b.horaFim) continue;
    const ini = Math.max(minutos(horaInicio), minutos(b.horaInicio));
    const fim = Math.min(minutos(horaFim), minutos(b.horaFim));
    for (let m = ini; m < fim; m++) ocupados.add(m);
  }
  return Math.min(HORAS_POR_TURNO, ocupados.size / 60);
}

/** "Dia inteiro" ou "13:00–17:00". */
export function horarioDoBloqueio(b: BloqueioAgenda): string {
  return b.diaInteiro || !b.horaInicio || !b.horaFim ? "Dia inteiro" : `${b.horaInicio}–${b.horaFim}`;
}

/** "12/10/2026" ou "12/10/2026 a 16/10/2026". */
export function periodoDoBloqueio(b: BloqueioAgenda): string {
  return b.dataInicio === b.dataFim ? dataBR(b.dataInicio) : `${dataBR(b.dataInicio)} a ${dataBR(b.dataFim)}`;
}

/** Mensagem de erro padrão quando um lançamento cai num bloqueio. */
export function mensagemConflitoBloqueio(conflitos: BloqueioAgenda[]): string {
  const b = conflitos[0];
  return `A agenda está bloqueada nesse horário (${horarioDoBloqueio(b)} · ${periodoDoBloqueio(b)}${b.motivo ? ` · ${b.motivo}` : ""}). Escolha outro horário ou remova o bloqueio.`;
}

/** Administrador mexe em qualquer bloqueio; o consultor só nos que ele mesmo criou na própria agenda. */
export function podeGerenciarBloqueio(usuario: Usuario, b: BloqueioAgenda): boolean {
  if (usuario.perfil === "administrador") return true;
  return usuario.perfil === "consultor" && b.recursoId === usuario.recursoId && b.criadoPorUid === usuario.uid;
}

/** Quem pode criar bloqueios: administrador (para qualquer consultor) e consultor com recurso (na própria agenda). */
export function podeCriarBloqueio(usuario: Usuario): boolean {
  return usuario.perfil === "administrador" || (usuario.perfil === "consultor" && !!usuario.recursoId);
}
