import { describe, it, expect } from 'vitest';
import { cpfValido, cnpjValido, cpfCnpjValido, formatarCpfCnpj } from '../src/lib/documentos';

describe('validação de CPF', () => {
  it('aceita CPF válido com e sem máscara', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
  });
  it('rejeita dígito verificador errado', () => {
    expect(cpfValido('529.982.247-24')).toBe(false);
  });
  it('rejeita dígitos repetidos', () => {
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('00000000000')).toBe(false);
  });
  it('rejeita tamanho errado', () => {
    expect(cpfValido('123')).toBe(false);
  });
});

describe('validação de CNPJ', () => {
  it('aceita CNPJ válido com e sem máscara', () => {
    expect(cnpjValido('04.252.011/0001-10')).toBe(true);
    expect(cnpjValido('04252011000110')).toBe(true);
  });
  it('rejeita dígito verificador errado', () => {
    expect(cnpjValido('04.252.011/0001-11')).toBe(false);
  });
  it('rejeita dígitos repetidos', () => {
    expect(cnpjValido('11.111.111/1111-11')).toBe(false);
  });
});

describe('validação combinada CPF/CNPJ', () => {
  it('identifica o documento pelo tamanho', () => {
    expect(cpfCnpjValido('529.982.247-25')).toBe(true);
    expect(cpfCnpjValido('04.252.011/0001-10')).toBe(true);
    expect(cpfCnpjValido('12345')).toBe(false);
    expect(cpfCnpjValido('')).toBe(false);
  });
});

describe('formatação', () => {
  it('formata CPF e CNPJ', () => {
    expect(formatarCpfCnpj('52998224725')).toBe('529.982.247-25');
    expect(formatarCpfCnpj('04252011000110')).toBe('04.252.011/0001-10');
  });
});
