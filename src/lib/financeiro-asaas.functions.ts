import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { cpfCnpjValido, apenasDigitos } from './documentos';

const BASES = { sandbox: 'https://api-sandbox.asaas.com/v3', producao: 'https://api.asaas.com/v3' } as const;
type Ambiente = keyof typeof BASES;

type ConfigGateway = { gateway_ambiente: Ambiente; multa_bp: number; juros_bp: number };
type CadastroPagador = {
  residente_id: string; responsavel_nome: string; responsavel_telefone: string;
  responsavel_cpf_cnpj: string | null; responsavel_email: string | null;
  responsavel_cep: string | null; responsavel_logradouro: string | null; responsavel_numero: string | null;
  responsavel_complemento: string | null; responsavel_bairro: string | null; responsavel_cidade: string | null;
  responsavel_uf: string | null; gateway_cliente_id: string | null;
};

async function asaasFetch(caminho: string, ambiente: Ambiente, init: RequestInit = {}) {
  const chave = process.env['ASAAS_API_KEY'];
  if (!chave) throw new Error('Chave de API do Asaas ainda não configurada. Cadastre o segredo do gateway nas configurações do app.');
  const res = await fetch(`${BASES[ambiente]}${caminho}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', access_token: chave, ...(init.headers ?? {}) },
  });
  const corpo = await res.json().catch(() => ({})) as { errors?: { description?: string }[] } & Record<string, unknown>;
  if (!res.ok) throw new Error(corpo.errors?.[0]?.description ?? `O gateway recusou a operação (código ${res.status}). Tente novamente.`);
  return corpo;
}

async function carregarConfig(supabase: { from: (t: string) => ReturnType<typeof selecionar> }): Promise<ConfigGateway> {
  const { data, error } = await supabase.from('financeiro_config').select('gateway_ambiente,multa_bp,juros_bp').eq('id', true).maybeSingle();
  if (error || !data) throw new Error('Salve as configurações financeiras antes de emitir faturas.');
  return data as unknown as ConfigGateway;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function selecionar(): any { return null; }

async function garantirCliente(supabase: never, ambiente: Ambiente, cadastro: CadastroPagador): Promise<string> {
  const cpfCnpj = apenasDigitos(cadastro.responsavel_cpf_cnpj ?? '');
  if (!cpfCnpjValido(cpfCnpj)) throw new Error(`CPF/CNPJ do responsável ${cadastro.responsavel_nome} ausente ou inválido. Corrija o cadastro financeiro.`);
  if (cadastro.gateway_cliente_id) return cadastro.gateway_cliente_id;
  const busca = await asaasFetch(`/customers?cpfCnpj=${cpfCnpj}`, ambiente) as { data?: { id: string }[] };
  if (busca.data?.length) return busca.data[0].id;
  const cliente = await asaasFetch('/customers', ambiente, {
    method: 'POST',
    body: JSON.stringify({
      name: cadastro.responsavel_nome,
      cpfCnpj,
      email: cadastro.responsavel_email ?? undefined,
      mobilePhone: apenasDigitos(cadastro.responsavel_telefone ?? '') || undefined,
      postalCode: apenasDigitos(cadastro.responsavel_cep ?? '') || undefined,
      address: cadastro.responsavel_logradouro ?? undefined,
      addressNumber: cadastro.responsavel_numero ?? undefined,
      complement: cadastro.responsavel_complemento ?? undefined,
      province: cadastro.responsavel_bairro ?? undefined,
    }),
  }) as { id: string };
  return cliente.id;
}

const BILLING: Record<string, string> = { boleto: 'BOLETO', pix: 'PIX', boleto_pix: 'UNDEFINED' };

async function emitirNoGateway(
  supabase: never, ambiente: Ambiente, cfg: ConfigGateway, cadastro: CadastroPagador,
  dados: { faturaId: string; cobrancas: string[]; forma: string; vencimento: string; valorCentavos: number; descricao: string },
) {
  const clienteId = await garantirCliente(supabase, ambiente, cadastro);
  const pagamento = await asaasFetch('/payments', ambiente, {
    method: 'POST',
    body: JSON.stringify({
      customer: clienteId,
      billingType: BILLING[dados.forma] ?? 'UNDEFINED',
      value: dados.valorCentavos / 100,
      dueDate: dados.vencimento,
      description: dados.descricao,
      externalReference: dados.faturaId,
      fine: { value: cfg.multa_bp / 100 },
      interest: { value: cfg.juros_bp / 100 },
    }),
  }) as { id: string; invoiceUrl?: string; bankSlipUrl?: string };
  let linha: string | undefined; let pix: string | undefined;
  if (dados.forma !== 'pix') {
    const r = await asaasFetch(`/payments/${pagamento.id}/identificationField`, ambiente).catch(() => null) as { identificationField?: string } | null;
    linha = r?.identificationField;
  }
  if (dados.forma !== 'boleto') {
    const r = await asaasFetch(`/payments/${pagamento.id}/pixQrCode`, ambiente).catch(() => null) as { payload?: string } | null;
    pix = r?.payload;
  }
  return { clienteId, pagamento, linha, pix };
}

type SupabaseAutenticado = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (t: string) => ReturnType<typeof selecionar>;
};

async function autorizar(supabase: SupabaseAutenticado) {
  const { data } = await supabase.rpc('financeiro_tem_acesso');
  if (data !== true) throw new Error('Acesso financeiro não autorizado');
}

async function registrarFatura(supabase: SupabaseAutenticado, dados: Record<string, unknown>, operacao: string) {
  const { data, error } = await supabase.rpc('financeiro_fatura_operar', { _acao: 'registrar', _dados: dados, _operacao: operacao });
  if (error) throw new Error(error.message);
  return data;
}

export const emitirFaturaAsaas = createServerFn({ method: 'POST' })
  .inputValidator((dados: { faturaId: string; cobrancas: string[]; forma: 'boleto' | 'pix' | 'boleto_pix'; vencimento: string; operacao: string }) => dados)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseAutenticado;
    await autorizar(supabase);
    const cfg = await carregarConfig(supabase);
    const { data: cobrancas, error } = await supabase.from('financeiro_cobrancas').select('id,residente_id,descricao,valor_centavos,ajuste_centavos,cancelada').in('id', data.cobrancas);
    if (error || !cobrancas?.length) throw new Error('Cobranças não encontradas.');
    const residenteId = (cobrancas as { residente_id: string }[])[0].residente_id;
    const { data: cadastro } = await supabase.from('financeiro_cadastros').select('*').eq('residente_id', residenteId).maybeSingle();
    if (!cadastro) throw new Error('Complete o cadastro financeiro da residente antes de emitir a fatura.');
    const cad = cadastro as unknown as CadastroPagador;
    const valor = (cobrancas as { valor_centavos: number; ajuste_centavos: number }[]).reduce((s, c) => s + c.valor_centavos + c.ajuste_centavos, 0);
    const emitido = await emitirNoGateway(supabase as never, cfg.gateway_ambiente, cfg, cad, {
      faturaId: data.faturaId, cobrancas: data.cobrancas, forma: data.forma, vencimento: data.vencimento,
      valorCentavos: valor, descricao: `Residencial São Camilo · ${(cobrancas as { descricao: string }[]).map(c => c.descricao).join(' + ')}`.slice(0, 140),
    });
    await registrarFatura(supabase, {
      id: data.faturaId, pagador_nome: cad.responsavel_nome, pagador_cpf_cnpj: apenasDigitos(cad.responsavel_cpf_cnpj ?? ''),
      gateway_cliente_id: emitido.clienteId, gateway_cobranca_id: emitido.pagamento.id, forma: data.forma,
      valor_centavos: valor, vencimento: data.vencimento,
      link: emitido.pagamento.invoiceUrl ?? emitido.pagamento.bankSlipUrl ?? '', linha_digitavel: emitido.linha ?? '', pix_copia_cola: emitido.pix ?? '',
      cobrancas: data.cobrancas,
    }, data.operacao);
    return { id: data.faturaId, link: emitido.pagamento.invoiceUrl ?? emitido.pagamento.bankSlipUrl ?? '', linha: emitido.linha ?? '', pix: emitido.pix ?? '' };
  })
  .middleware([requireSupabaseAuth]);

export const cancelarFaturaAsaas = createServerFn({ method: 'POST' })
  .inputValidator((dados: { id: string; motivo: string; operacao: string }) => dados)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseAutenticado;
    await autorizar(supabase);
    const cfg = await carregarConfig(supabase);
    const { data: fatura } = await supabase.from('financeiro_faturas').select('gateway_cobranca_id,status').eq('id', data.id).maybeSingle();
    if (!fatura) throw new Error('Fatura não encontrada.');
    const gatewayId = (fatura as { gateway_cobranca_id: string | null }).gateway_cobranca_id;
    if (gatewayId) await asaasFetch(`/payments/${gatewayId}`, cfg.gateway_ambiente, { method: 'DELETE' });
    const { error } = await supabase.rpc('financeiro_fatura_operar', { _acao: 'cancelar', _dados: { id: data.id, motivo: data.motivo }, _operacao: data.operacao });
    if (error) throw new Error(error.message);
    return { ok: true };
  })
  .middleware([requireSupabaseAuth]);

const SITUACAO: Record<string, string> = {
  RECEIVED: 'recebida', CONFIRMED: 'recebida', RECEIVED_IN_CASH: 'recebida',
  OVERDUE: 'vencida', DELETED: 'cancelada', REFUNDED: 'estornada',
};

export const sincronizarFaturaAsaas = createServerFn({ method: 'POST' })
  .inputValidator((dados: { id: string; operacao: string }) => dados)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseAutenticado;
    await autorizar(supabase);
    const cfg = await carregarConfig(supabase);
    const { data: fatura } = await supabase.from('financeiro_faturas').select('gateway_cobranca_id,status').eq('id', data.id).maybeSingle();
    const gatewayId = (fatura as { gateway_cobranca_id: string | null } | null)?.gateway_cobranca_id;
    if (!gatewayId) throw new Error('Fatura sem cobrança no gateway.');
    const p = await asaasFetch(`/payments/${gatewayId}`, cfg.gateway_ambiente) as {
      status: string; value?: number; netValue?: number; paymentDate?: string; confirmedDate?: string;
      invoiceUrl?: string; bankSlipUrl?: string; identificationField?: string;
    };
    const situacao = SITUACAO[p.status];
    if (!situacao) return { situacao: 'sem-alteracao', status: p.status };
    const { error } = await supabase.rpc('financeiro_fatura_operar', {
      _acao: 'sincronizar',
      _dados: {
        id: data.id, situacao,
        valor_recebido_centavos: p.value != null ? Math.round(p.value * 100) : undefined,
        tarifa_centavos: p.value != null && p.netValue != null ? Math.max(0, Math.round((p.value - p.netValue) * 100)) : undefined,
        data_pagamento: p.paymentDate ?? p.confirmedDate,
        link: p.invoiceUrl ?? p.bankSlipUrl, linha_digitavel: p.identificationField,
      },
      _operacao: data.operacao,
    });
    if (error) throw new Error(error.message);
    return { situacao };
  })
  .middleware([requireSupabaseAuth]);

export const gerarFaturasMesAsaas = createServerFn({ method: 'POST' })
  .inputValidator((dados: { mes: string; forma: 'boleto' | 'pix' | 'boleto_pix' }) => dados)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseAutenticado;
    await autorizar(supabase);
    const cfg = await carregarConfig(supabase);
    const { data: cobrancas } = await supabase.from('financeiro_cobrancas')
      .select('id,residente_id,descricao,valor_centavos,ajuste_centavos,vencimento,cancelada')
      .gte('vencimento', `${data.mes}-01`).lte('vencimento', `${data.mes}-31`).eq('cancelada', false);
    const { data: vinculos } = await supabase.from('financeiro_fatura_cobrancas').select('cobranca_id,fatura_id');
    const { data: faturasAtivas } = await supabase.from('financeiro_faturas').select('id,status').in('status', ['aguardando', 'vencida']);
    const ativas = new Set((faturasAtivas as { id: string }[] ?? []).map(f => f.id));
    const travadas = new Set((vinculos as { cobranca_id: string; fatura_id: string }[] ?? []).filter(v => ativas.has(v.fatura_id)).map(v => v.cobranca_id));
    const { data: cadastros } = await supabase.from('financeiro_cadastros').select('*');
    const porResidente = new Map((cadastros as unknown as CadastroPagador[] ?? []).map(c => [c.residente_id, c]));
    const grupos = new Map<string, { cadastro: CadastroPagador; cobrancas: { id: string; descricao: string; valor_centavos: number; ajuste_centavos: number; vencimento: string }[] }>();
    for (const c of (cobrancas as { id: string; residente_id: string; descricao: string; valor_centavos: number; ajuste_centavos: number; vencimento: string }[] ?? [])) {
      if (travadas.has(c.id)) continue;
      const cad = porResidente.get(c.residente_id);
      if (!cad) continue;
      const chave = apenasDigitos(cad.responsavel_cpf_cnpj ?? '') || `sem-doc:${cad.responsavel_nome}`;
      const grupo = grupos.get(chave) ?? { cadastro: cad, cobrancas: [] };
      grupo.cobrancas.push(c);
      grupos.set(chave, grupo);
    }
    const sucessos: { pagador: string; fatura: string }[] = [];
    const falhas: { pagador: string; motivo: string }[] = [];
    for (const grupo of grupos.values()) {
      const faturaId = crypto.randomUUID();
      try {
        const valor = grupo.cobrancas.reduce((s, c) => s + c.valor_centavos + c.ajuste_centavos, 0);
        const vencimento = grupo.cobrancas.map(c => c.vencimento).sort()[0];
        const emitido = await emitirNoGateway(supabase as never, cfg.gateway_ambiente, cfg, grupo.cadastro, {
          faturaId, cobrancas: grupo.cobrancas.map(c => c.id), forma: data.forma, vencimento,
          valorCentavos: valor, descricao: `Residencial São Camilo · faturas ${data.mes}`.slice(0, 140),
        });
        await registrarFatura(supabase, {
          id: faturaId, pagador_nome: grupo.cadastro.responsavel_nome, pagador_cpf_cnpj: apenasDigitos(grupo.cadastro.responsavel_cpf_cnpj ?? ''),
          gateway_cliente_id: emitido.clienteId, gateway_cobranca_id: emitido.pagamento.id, forma: data.forma,
          valor_centavos: valor, vencimento,
          link: emitido.pagamento.invoiceUrl ?? emitido.pagamento.bankSlipUrl ?? '', linha_digitavel: emitido.linha ?? '', pix_copia_cola: emitido.pix ?? '',
          cobrancas: grupo.cobrancas.map(c => c.id),
        }, crypto.randomUUID());
        sucessos.push({ pagador: grupo.cadastro.responsavel_nome, fatura: faturaId });
      } catch (e) {
        falhas.push({ pagador: grupo.cadastro.responsavel_nome, motivo: e instanceof Error ? e.message : 'Falha desconhecida' });
      }
    }
    return { sucessos, falhas };
  })
  .middleware([requireSupabaseAuth]);
