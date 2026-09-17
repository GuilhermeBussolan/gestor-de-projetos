export function somenteDigitos(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

/** Valida um CNPJ (formatado ou não) pelos dígitos verificadores oficiais. */
export function cnpjValido(valor: string): boolean {
  const cnpj = somenteDigitos(valor);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  function calcularDigito(base: string, pesos: number[]): number {
    const soma = base
      .split("")
      .reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const digito1 = calcularDigito(cnpj.slice(0, 12), pesos1);
  if (digito1 !== Number(cnpj[12])) return false;

  const digito2 = calcularDigito(cnpj.slice(0, 13), pesos2);
  if (digito2 !== Number(cnpj[13])) return false;

  return true;
}

export function formatarCnpj(valor: string): string {
  const d = somenteDigitos(valor);
  if (d.length !== 14) return valor;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}
