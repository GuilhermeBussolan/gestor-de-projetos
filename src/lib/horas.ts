export function horaParaMinutos(hora: string): number {
  if (!hora) return 0;
  const [h, m] = hora.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function calcularTotalHoras(horaInicio: string, horaFim: string, horaDesconto: string): number {
  const minutos =
    horaParaMinutos(horaFim) - horaParaMinutos(horaInicio) - horaParaMinutos(horaDesconto || "00:00");
  return Math.max(0, Math.round((minutos / 60) * 100) / 100);
}

export function formatarHoras(totalHoras: number): string {
  const valor = Number.isFinite(totalHoras) ? totalHoras : 0;
  // Arredonda o total em minutos antes de separar horas e minutos — separar primeiro dava "03:60"
  // para 3,9999h.
  const totalMinutos = Math.round(valor * 60);
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos - horas * 60;
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}
