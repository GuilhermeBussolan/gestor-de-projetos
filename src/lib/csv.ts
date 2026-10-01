/**
 * Célula de CSV (separador ";") segura para abrir no Excel. Um texto que começa com "=", "+", "@" ou "-" seguido de
 * letra é lido pelo Excel como FÓRMULA — um nome de cliente ou uma descrição maliciosa poderia rodar comandos ou vazar
 * dados ao abrir a planilha. Esses textos ganham um apóstrofo na frente (o Excel mostra o texto como está). Valores em
 * dinheiro negativos ("-R$ 10,00") e números negativos continuam como estão.
 */
export function celulaCsv(valor: string): string {
  const v = /^[=+@\t\r]/.test(valor) || /^-(?![\d\s]|R\$)/.test(valor) ? `'${valor}` : valor;
  return `"${v.replace(/"/g, '""')}"`;
}

/** Uma linha do CSV com as células já protegidas. */
export const linhaCsv = (celulas: string[]) => celulas.map(celulaCsv).join(";");
