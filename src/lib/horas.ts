export function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function calcularTotalHoras(horaInicio: string, horaFim: string, horaDesconto: string): number {
  const minutos =
    horaParaMinutos(horaFim) - horaParaMinutos(horaInicio) - horaParaMinutos(horaDesconto || "00:00");
  return Math.max(0, Math.round((minutos / 60) * 100) / 100);
}

export function formatarHoras(totalHoras: number): string {
  const horas = Math.floor(totalHoras);
  const minutos = Math.round((totalHoras - horas) * 60);
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}
