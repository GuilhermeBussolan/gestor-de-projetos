export function formatarDataBR(iso: string): string {
  return iso.split("-").reverse().join("/");
}

export function formatarPeriodoProjeto(dataInicio?: string | null, dataFim?: string | null) {
  if (!dataInicio) return null;
  return {
    inicio: formatarDataBR(dataInicio),
    fim: dataFim ? formatarDataBR(dataFim) : null,
  };
}
