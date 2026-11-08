export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function digitosRepetidos(d: string): boolean {
  return /^(\d)\1+$/.test(d);
}

export function cpfValido(cpf: string): boolean {
  const d = apenasDigitos(cpf);
  if (d.length !== 11 || digitosRepetidos(d)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(d[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(d[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(d[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === Number(d[10]);
}

export function cnpjValido(cnpj: string): boolean {
  const d = apenasDigitos(cnpj);
  if (d.length !== 14 || digitosRepetidos(d)) return false;
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 12; i++) soma += Number(d[i]) * pesos1[i];
  let resto = soma % 11;
  const dig1 = resto < 2 ? 0 : 11 - resto;
  if (dig1 !== Number(d[12])) return false;
  soma = 0;
  for (let i = 0; i < 13; i++) soma += Number(d[i]) * pesos2[i];
  resto = soma % 11;
  const dig2 = resto < 2 ? 0 : 11 - resto;
  return dig2 === Number(d[13]);
}

export function cpfCnpjValido(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length === 11) return cpfValido(d);
  if (d.length === 14) return cnpjValido(d);
  return false;
}

export function formatarCpfCnpj(valor: string): string {
  const d = apenasDigitos(valor);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return valor;
}
