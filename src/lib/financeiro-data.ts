import { queryOptions, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { Saldo } from './financeiro';
type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type CobrancaFinanceira = Row<'financeiro_cobrancas'> & { calculo: Saldo };
export type FinanceiroDados = {
  hoje: string;
  residentes: { id: string; nome: string; ativo: boolean; responsavel: string | null; telefone: string | null }[];
  cadastros: Row<'financeiro_cadastros'>[]; catalogo: Row<'financeiro_catalogo'>[]; config: Row<'financeiro_config'> | null;
  cobrancas: CobrancaFinanceira[]; itens: Row<'financeiro_itens'>[]; pagamentos: Row<'financeiro_pagamentos'>[];
  alocacoes: Row<'financeiro_alocacoes'>[]; contatos: Row<'financeiro_contatos'>[]; caixa: Row<'financeiro_caixa'>[]; auditoria: Row<'financeiro_auditoria'>[];
};
export const financeiroAcessoOptions = queryOptions({
  queryKey: ['financeiro-acesso'], staleTime: 60_000,
  queryFn: async () => { const { data, error } = await supabase.rpc('financeiro_tem_acesso'); if (error) throw error; return data === true; },
});
export function useFinanceiroAcesso() { return useQuery(financeiroAcessoOptions); }
export const financeiroDadosOptions = queryOptions({
  queryKey: ['financeiro-dados'], staleTime: 20_000,
  queryFn: async () => { const { data, error } = await supabase.rpc('financeiro_resumo'); if (error) throw error; return data as unknown as FinanceiroDados; },
});
export async function operarFinanceiro(acao: string, dados: Record<string, unknown>, operacao: string) {
  const { data, error } = await supabase.rpc('financeiro_operar', { _acao: acao, _dados: dados as Database['public']['Functions']['financeiro_operar']['Args']['_dados'], _operacao: operacao });
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}
export function creditoResidente(d: FinanceiroDados, residente: string) {
  return d.pagamentos.filter(p => p.residente_id === residente && !p.estornado && p.forma !== 'credito').reduce((s, p) => {
    const alocado = d.alocacoes.filter(a => a.pagamento_id === p.id).reduce((v, a) => v + a.principal_centavos + a.multa_centavos + a.juros_centavos + a.correcao_centavos, 0);
    const usado = d.pagamentos.filter(u => u.fonte_credito === p.id && !u.estornado).reduce((v, u) => v + u.valor_centavos, 0);
    return s + p.valor_centavos - alocado - usado;
  }, 0);
}