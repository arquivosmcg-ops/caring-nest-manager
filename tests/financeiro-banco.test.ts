import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

function sql(query: string) {
  return execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-Atc', query], { encoding: 'utf8' });
}
const podeExecutarTransacoes = sql("SELECT has_function_privilege(current_user,'public.financeiro_operar(text,jsonb,uuid)','EXECUTE');").trim() === 't';
const setup = `
  PERFORM set_config('request.jwt.claim.sub', (SELECT user_id::text FROM public.user_roles WHERE role='admin' LIMIT 1), true);
  SELECT id INTO residente FROM public.residentes LIMIT 1;
  PERFORM public.financeiro_operar('config','{"multa_bp":200,"juros_bp":100,"carencia":0,"correcao_bp":0,"extras_agrupados":true,"alerta_dias":3,"inadimplencia_dias":30,"mensagem":"Teste","automatico":false}',gen_random_uuid());
  PERFORM public.financeiro_operar('cadastro',jsonb_build_object('residente_id',residente,'mensalidade_centavos',10000,'dia_vencimento',10,'responsavel_nome','Teste transacional','responsavel_telefone','','forma_preferencial','pix'),gen_random_uuid());
`;
function transaction(body: string) {
  return sql(`BEGIN; DO $$ DECLARE residente uuid; cobranca uuid; pagamento uuid; op uuid; x jsonb; y jsonb; n integer; BEGIN ${setup} ${body} END $$; SELECT 'ok'; ROLLBACK;`);
}
describe.skipIf(!podeExecutarTransacoes)('Financeiro — regras reais do banco, com reversão dos dados de teste (exige conexão de teste autorizada)', () => {
  it('calcula 2% de multa e 1% de juros simples em 30 dias', () => {
    expect(transaction(`
      PERFORM public.financeiro_operar('avulsa',jsonb_build_object('residente_id',residente,'data','2026-01-01','vencimento','2026-01-01','valor_centavos',10000,'descricao','Teste','categoria','outros'),gen_random_uuid());
      SELECT id INTO cobranca FROM public.financeiro_cobrancas WHERE residente_id=residente AND descricao='Teste' ORDER BY criado_em DESC LIMIT 1;
      x=private.financeiro_saldo(cobranca,'2026-01-31');
      IF (x->>'multa')::bigint<>200 OR (x->>'juros')::bigint<>100 THEN RAISE EXCEPTION 'Encargos incorretos: %',x;END IF;
    `)).toContain('ok');
  });
  it('pagamento parcial abate encargos antes do principal e estorno restaura dívida', () => {
    expect(transaction(`
      PERFORM public.financeiro_operar('avulsa',jsonb_build_object('residente_id',residente,'data','2026-01-01','vencimento','2026-01-01','valor_centavos',10000,'descricao','Teste parcial','categoria','outros'),gen_random_uuid());
      SELECT id INTO cobranca FROM public.financeiro_cobrancas WHERE residente_id=residente AND descricao='Teste parcial' ORDER BY criado_em DESC LIMIT 1;
      x=public.financeiro_operar('pagamento',jsonb_build_object('residente_id',residente,'data','2026-01-31','valor_centavos',5300,'forma','pix','alocacoes',jsonb_build_array(jsonb_build_object('id',cobranca,'valor',5300))),gen_random_uuid());
      pagamento=(x->>'id')::uuid;y=private.financeiro_saldo(cobranca,'2026-03-02');
      IF (y->>'principal')::bigint<>5000 OR (y->>'juros')::bigint<>50 OR (y->>'multa')::bigint<>0 THEN RAISE EXCEPTION 'Parcial incorreto %',y;END IF;
      PERFORM public.financeiro_operar('estornar',jsonb_build_object('id',pagamento,'motivo','Teste de estorno'),gen_random_uuid());y=private.financeiro_saldo(cobranca,'2026-03-02');
      IF (y->>'principal')::bigint<>10000 OR (y->>'juros')::bigint<>200 OR (y->>'multa')::bigint<>200 THEN RAISE EXCEPTION 'Estorno incorreto %',y;END IF;
    `)).toContain('ok');
  });
  it('retry não duplica pagamento e valor excedente vira crédito', () => {
    expect(transaction(`
      PERFORM public.financeiro_operar('avulsa',jsonb_build_object('residente_id',residente,'data',current_date,'vencimento',current_date,'valor_centavos',10000,'descricao','Teste crédito','categoria','outros'),gen_random_uuid());
      SELECT id INTO cobranca FROM public.financeiro_cobrancas WHERE residente_id=residente AND descricao='Teste crédito' ORDER BY criado_em DESC LIMIT 1;
      op=gen_random_uuid();x=public.financeiro_operar('pagamento',jsonb_build_object('residente_id',residente,'data',current_date,'valor_centavos',15000,'forma','pix','alocacoes',jsonb_build_array(jsonb_build_object('id',cobranca,'valor',10000))),op);
      y=public.financeiro_operar('pagamento',jsonb_build_object('residente_id',residente,'data',current_date,'valor_centavos',15000,'forma','pix'),op);
      IF x<>y OR (x->>'credito')::bigint<>5000 THEN RAISE EXCEPTION 'Idempotência ou crédito incorreto';END IF;
    `)).toContain('ok');
  });
  it('fechamento impede recebimento e reabertura exige motivo', () => {
    expect(transaction(`
      PERFORM public.financeiro_operar('caixa',jsonb_build_object('data',current_date,'fechado',true),gen_random_uuid());
      BEGIN PERFORM public.financeiro_operar('pagamento',jsonb_build_object('residente_id',residente,'data',current_date,'valor_centavos',100,'forma','pix'),gen_random_uuid()); RAISE EXCEPTION 'FECHAMENTO NÃO BLOQUEOU'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%caixa desta data está fechado%' THEN RAISE;END IF;END;
      BEGIN PERFORM public.financeiro_operar('caixa',jsonb_build_object('data',current_date,'fechado',false),gen_random_uuid());RAISE EXCEPTION 'REABERTURA SEM MOTIVO';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%motivo da reabertura%' THEN RAISE;END IF;END;
      PERFORM public.financeiro_operar('caixa',jsonb_build_object('data',current_date,'fechado',false,'motivo','Teste'),gen_random_uuid());
    `)).toContain('ok');
  });
  it('mensalidade manual não duplica residente e mês', () => {
    expect(transaction(`
      x=public.financeiro_operar('mensalidades','{"mes":"2026-02-01"}',gen_random_uuid());
      y=public.financeiro_operar('mensalidades','{"mes":"2026-02-01"}',gen_random_uuid());
      IF (y->>'geradas')::integer<>0 THEN RAISE EXCEPTION 'Mensalidades duplicadas';END IF;
      SELECT count(*) INTO n FROM public.financeiro_cobrancas WHERE residente_id=residente AND tipo='mensalidade' AND competencia='2026-02-01';IF n<>1 THEN RAISE EXCEPTION 'Quantidade incorreta %',n;END IF;
    `)).toContain('ok');
  });
  it('consumo em lote é atômico e agrupado com vencimento no mês seguinte', () => {
    expect(transaction(`
      x=public.financeiro_operar('catalogo','{"nome":"Teste lote","categoria":"higiene","unidade":"un","valor_centavos":1234}',gen_random_uuid());op=(x->>'id')::uuid;
      PERFORM public.financeiro_operar('consumo',jsonb_build_object('data','2026-01-02','residentes',jsonb_build_array(residente),'itens',jsonb_build_array(jsonb_build_object('catalogo_id',op,'quantidade',2,'valor_centavos',1234))),gen_random_uuid());
      SELECT id INTO cobranca FROM public.financeiro_cobrancas WHERE residente_id=residente AND tipo='extras' AND competencia='2026-01-01';
      IF (SELECT valor_centavos<>2468 OR vencimento<>'2026-02-10' FROM public.financeiro_cobrancas WHERE id=cobranca) THEN RAISE EXCEPTION 'Extras incorretos';END IF;
      BEGIN PERFORM public.financeiro_operar('consumo',jsonb_build_object('data','2026-01-02','residentes',jsonb_build_array(residente),'itens',jsonb_build_array(jsonb_build_object('catalogo_id',op,'quantidade',1,'valor_centavos',1234),jsonb_build_object('catalogo_id',gen_random_uuid(),'quantidade',1,'valor_centavos',100))),gen_random_uuid());RAISE EXCEPTION 'ITEM INVÁLIDO ACEITO';EXCEPTION WHEN no_data_found THEN NULL;END;
      IF (SELECT valor_centavos FROM public.financeiro_cobrancas WHERE id=cobranca)<>2468 THEN RAISE EXCEPTION 'Falha de atomicidade';END IF;
    `)).toContain('ok');
  });
  it('apenas admin ou financeiro concedido e aprovado acessam, não basta escolher função', () => {
    expect(transaction(`
      SELECT id INTO pagamento FROM public.profiles WHERE id<>auth.uid() LIMIT 1;
      UPDATE public.profiles SET funcao='administrador_financeiro',status_aprovacao='aprovado' WHERE id=pagamento;
      PERFORM set_config('request.jwt.claim.sub',pagamento::text,true);
      IF NOT public.financeiro_tem_acesso() THEN RAISE EXCEPTION 'Financeiro aprovado sem acesso';END IF;
      IF private.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Financeiro ganhou admin geral';END IF;
      UPDATE public.financeiro_acessos SET usuario_id=usuario_id WHERE usuario_id=pagamento;
      DELETE FROM public.financeiro_acessos WHERE usuario_id=pagamento;
      IF public.financeiro_tem_acesso() THEN RAISE EXCEPTION 'Escolher função deu acesso';END IF;
      BEGIN PERFORM public.financeiro_resumo();RAISE EXCEPTION 'SEM PERMISSÃO CONSEGUIU LER';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Acesso financeiro não autorizado%' THEN RAISE;END IF;END;
    `)).toContain('ok');
  });
});
describe('Financeiro — privilégios efetivos', () => {
  it('exige admin geral ou concessão financeira com função aprovada', () => {
    const helper=sql("SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname='financeiro_autorizado';");
    expect(helper).toContain("role = 'admin'");
    expect(helper).toContain('financeiro_acessos');
    expect(helper).toContain("funcao = 'administrador_financeiro'");
    expect(helper).toContain("status_aprovacao = 'aprovado'");
    expect(helper).not.toContain('raw_user_meta_data');
  });
  it('todas as tabelas financeiras ficam protegidas e sem escrita direta por usuários', () => {
    const output=sql("SELECT count(*) FROM pg_tables t WHERE t.schemaname='public' AND t.tablename LIKE 'financeiro_%' AND (NOT t.rowsecurity OR has_table_privilege('anon',format('%I.%I',t.schemaname,t.tablename),'SELECT') OR has_table_privilege('authenticated',format('%I.%I',t.schemaname,t.tablename),'INSERT,UPDATE,DELETE'));");
    expect(output.trim()).toBe('0');
  });
  it('visitante não tem acesso de leitura a tabelas nem execução de operações', () => {
    const output=sql(`SELECT has_table_privilege('anon','public.financeiro_cobrancas','SELECT'),has_function_privilege('anon','public.financeiro_operar(text,jsonb,uuid)','EXECUTE'),has_table_privilege('authenticated','public.financeiro_cobrancas','DELETE');`);
    expect(output.trim()).toBe('f|f|f');
  });
});