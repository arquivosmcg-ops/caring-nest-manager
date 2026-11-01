import { describe, it, expect } from 'vitest';
import { calcularSaldo, alocarPagamento, centavos, diaVencimentoSchema, nivelAlerta } from '../src/lib/financeiro';
describe('Regras do Financeiro', () => {
  it('guarda R$ 12,34 como 1234 centavos', () => expect(centavos('12,34')).toBe(1234));
  it('permite vencimentos de 1 a 28 e recusa 29', () => { expect(diaVencimentoSchema.parse(1)).toBe(1); expect(diaVencimentoSchema.parse(28)).toBe(28); expect(diaVencimentoSchema.safeParse(29).success).toBe(false); });
  it('aplica multa de 2% uma vez', () => { expect(calcularSaldo(10000, '2026-01-01', '2026-02-01').multa).toBe(200); expect(calcularSaldo(10000, '2026-01-01', '2026-03-01').multa).toBe(200); });
  it('cobra juros simples de 1% em 30 dias', () => expect(calcularSaldo(10000, '2026-01-01', '2026-01-31').juros).toBe(100));
  it('cobra metade dos juros em 15 dias', () => expect(calcularSaldo(10000, '2026-01-01', '2026-01-16').juros).toBe(50));
  it('carência impede encargos por cinco dias', () => { expect(calcularSaldo(10000, '2026-01-01', '2026-01-06', [], 200, 100, 5).juros).toBe(0); expect(calcularSaldo(10000, '2026-01-01', '2026-01-07', [], 200, 100, 5).juros).toBe(3); });
  it('pago deixa de gerar juros sobre a parte quitada', () => expect(calcularSaldo(10000, '2026-01-01', '2026-03-02', [{ data: '2026-01-31', principal: 5000, multa: 0, juros: 0, correcao: 0 }], 0).juros).toBe(150));
  it('quita encargos antes do principal da cobrança mais antiga', () => { const saldo = calcularSaldo(10000, '2026-01-01', '2026-01-02', [], 200, 0); const a = alocarPagamento(500, [{ id: 'nova', vencimento: '2026-01-02', calculo: saldo }, { id: 'antiga', vencimento: '2026-01-01', calculo: saldo }]); expect(a.alocacoes[0]).toMatchObject({ id: 'antiga', multa: 200, principal: 300 }); });
  it('excedente gera crédito', () => { const saldo = calcularSaldo(10000, '2026-01-01', '2026-01-01'); expect(alocarPagamento(15000, [{ id: 'a', vencimento: '2026-01-01', calculo: saldo }]).credito).toBe(5000); });
  it('alerta três dias antes e inadimplência após 30 dias', () => { expect(nivelAlerta('2026-01-04', '2026-01-01', 100)).toBe('Vence em breve'); expect(nivelAlerta('2026-01-01', '2026-01-31', 100)).toBe('Atrasado'); expect(nivelAlerta('2026-01-01', '2026-02-01', 100)).toBe('Inadimplente'); });
  it('pagamento no vencimento não tem multa nem juros', () => { const s = calcularSaldo(10000, '2026-01-01', '2026-01-01'); expect(s.multa).toBe(0); expect(s.juros).toBe(0); });
});