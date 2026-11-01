import { z } from 'zod';

export const categoriasFinanceiras = { mensalidade: 'Mensalidade', dieta_suplemento: 'Dieta/Suplemento', higiene: 'Material de higiene', bordado: 'Bordado/Marcação', outros: 'Outros' };
export const formasFinanceiras = { pix: 'Pix', dinheiro: 'Dinheiro', transferencia: 'Transferência', boleto: 'Boleto', cartao: 'Cartão', cheque: 'Cheque' };
export const reais = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v / 100);
export const dataBr = (v: string) => v ? v.slice(0, 10).split('-').reverse().join('/') : '—';
export function centavos(v: string): number {
  const text = v.trim().replace(/R\$\s*/, '').replace(/\s/g, '');
  const number = Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text);
  if (!Number.isFinite(number) || Math.abs(number) > 1_000_000_000) throw new Error('Informe um valor válido');
  return Math.round(number * 100);
}
export const diaVencimentoSchema = z.number().int().min(1).max(28);
export type Saldo = { principal: number; multa: number; juros: number; correcao: number; saldo: number; dias: number; pago: number; status: string };
export type EventoFinanceiro = { data: string; principal: number; multa: number; juros: number; correcao: number };
const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
export function calcularSaldo(original: number, vencimento: string, hoje: string, eventos: EventoFinanceiro[] = [], multaBp = 200, jurosBp = 100, carencia = 0, correcaoBp = 0): Saldo {
  let principal = original, multa = 0, juros = 0, correcao = 0, pago = 0;
  let pm = 0, pj = 0, pc = 0, ultimo = carencia, multaAplicada = false;
  const adicionar = (data: string) => {
    const dias = diasEntre(vencimento, data);
    if (dias <= carencia) return;
    if (!multaAplicada) { multa = Math.round(principal * multaBp / 10000); multaAplicada = true; }
    const intervalo = Math.max(0, dias - ultimo);
    juros += principal * jurosBp / 10000 * intervalo / 30;
    correcao += principal * correcaoBp / 10000 * intervalo / 30;
    ultimo = dias;
  };
  for (const e of [...eventos].filter(e => e.data <= hoje).sort((a, b) => a.data.localeCompare(b.data))) {
    adicionar(e.data); principal = Math.max(0, principal - e.principal); pm += e.multa; pj += e.juros; pc += e.correcao; pago += e.principal + e.multa + e.juros + e.correcao;
  }
  adicionar(hoje);
  multa = Math.max(0, multa - pm); juros = Math.max(0, Math.round(juros) - pj); correcao = Math.max(0, Math.round(correcao) - pc);
  const saldo = principal + multa + juros + correcao;
  return { principal, multa, juros, correcao, saldo, pago, dias: Math.max(0, diasEntre(vencimento, hoje)), status: !saldo ? 'Paga' : hoje > vencimento ? 'Vencida' : pago ? 'Parcialmente paga' : 'Em aberto' };
}
export function alocarPagamento(valor: number, cobrancas: { id: string; vencimento: string; calculo: Saldo }[]) {
  let restante = valor;
  const alocacoes = [...cobrancas].sort((a, b) => a.vencimento.localeCompare(b.vencimento)).map(c => {
    const total = Math.min(restante, c.calculo.saldo);
    let livre = total;
    const multa = Math.min(livre, c.calculo.multa); livre -= multa;
    const juros = Math.min(livre, c.calculo.juros); livre -= juros;
    const correcao = Math.min(livre, c.calculo.correcao); livre -= correcao;
    const principal = Math.min(livre, c.calculo.principal);
    restante -= total;
    return { id: c.id, total, multa, juros, correcao, principal };
  }).filter(a => a.total > 0);
  return { alocacoes, credito: restante };
}
export function nivelAlerta(vencimento: string, hoje: string, saldo: number, breve = 3, inadimplencia = 30) {
  if (saldo <= 0) return null;
  const dias = diasEntre(vencimento, hoje);
  if (dias > inadimplencia) return 'Inadimplente';
  if (dias > 0) return 'Atrasado';
  if (dias === 0) return 'Vence hoje';
  return dias >= -breve ? 'Vence em breve' : null;
}