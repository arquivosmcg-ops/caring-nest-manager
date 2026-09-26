-- Testes automatizados de regras de acesso (RLS).
-- Executar: psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_fraldas_escala.sql
-- Tudo roda dentro de uma transação desfeita ao final (nenhum dado é alterado).
BEGIN;

CREATE TEMP TABLE _ids ON COMMIT DROP AS
SELECT
  (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1) AS admin_id,
  (SELECT p.id FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r
                      WHERE r.user_id = p.id AND r.role IN ('admin','gerente'))
    LIMIT 1) AS comum_id;
GRANT SELECT ON _ids TO anon, authenticated;

DO $$ BEGIN
  IF (SELECT admin_id FROM _ids) IS NULL OR (SELECT comum_id FROM _ids) IS NULL THEN
    RAISE EXCEPTION 'Faltam usuários de teste (admin e comum)';
  END IF;
END $$;

-- 1) Visitante (anon) lê produtos de fraldas, mas não altera
SET LOCAL ROLE anon;
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.produtos_fraldas;
  RAISE NOTICE 'OK anon leu % produtos de fraldas', n;
  BEGIN
    INSERT INTO public.produtos_fraldas(nome_produto, unidades_padrao_por_pacote, tipo_sugerido)
    VALUES ('TESTE', 1, 'tradicional');
    RAISE EXCEPTION 'FALHA: anon inseriu produto';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK anon não insere';
  END;
  UPDATE public.produtos_fraldas SET ordem = ordem;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN RAISE EXCEPTION 'FALHA: anon alterou produtos'; END IF;
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK anon não altera';
END $$;
DO $$ BEGIN
  PERFORM 1 FROM public.escala_turnos LIMIT 1;
  RAISE EXCEPTION 'FALHA: anon leu escala_turnos';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK anon sem acesso à escala';
END $$;
RESET ROLE;

-- 2) Usuário comum: não altera produtos; vê só os próprios dados da escala
SELECT set_config('request.jwt.claims',
  json_build_object('sub', comum_id, 'role', 'authenticated')::text, true) FROM _ids;
SET LOCAL ROLE authenticated;
DO $$
DECLARE n int; me uuid := auth.uid();
BEGIN
  UPDATE public.produtos_fraldas SET ordem = ordem;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN RAISE EXCEPTION 'FALHA: usuário comum alterou produtos'; END IF;
  BEGIN
    INSERT INTO public.produtos_fraldas(nome_produto, unidades_padrao_por_pacote, tipo_sugerido)
    VALUES ('TESTE', 1, 'tradicional');
    RAISE EXCEPTION 'FALHA: usuário comum inseriu produto';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
  END;
  RAISE NOTICE 'OK usuário comum não altera produtos';

  SELECT count(*) INTO n FROM public.escala_turnos WHERE colaborador_id <> me;
  IF n > 0 THEN RAISE EXCEPTION 'FALHA: comum vê % turnos de colegas', n; END IF;
  SELECT count(*) INTO n FROM public.escala_afastamentos WHERE colaborador_id <> me;
  IF n > 0 THEN RAISE EXCEPTION 'FALHA: comum vê % afastamentos de colegas', n; END IF;
  SELECT count(*) INTO n FROM public.escala_config;
  IF n > 0 THEN RAISE EXCEPTION 'FALHA: comum lê configuração da escala'; END IF;
  SELECT count(*) INTO n FROM public.escala_historico WHERE user_id IS DISTINCT FROM me;
  IF n > 0 THEN RAISE EXCEPTION 'FALHA: comum vê histórico alheio'; END IF;
  RAISE NOTICE 'OK escala restrita para usuário comum';
END $$;
RESET ROLE;

-- 3) Administrador: altera produtos e vê toda a escala
SELECT set_config('request.jwt.claims',
  json_build_object('sub', admin_id, 'role', 'authenticated')::text, true) FROM _ids;
SET LOCAL ROLE authenticated;
DO $$
DECLARE n int; total int;
BEGIN
  INSERT INTO public.produtos_fraldas(nome_produto, unidades_padrao_por_pacote, tipo_sugerido)
  VALUES ('TESTE ADMIN', 1, 'tradicional');
  UPDATE public.produtos_fraldas SET ordem = ordem WHERE nome_produto = 'TESTE ADMIN';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA: admin não alterou produto'; END IF;
  DELETE FROM public.produtos_fraldas WHERE nome_produto = 'TESTE ADMIN';
  RAISE NOTICE 'OK admin insere/altera/exclui produtos';
  SELECT count(*) INTO n FROM public.escala_config;
  IF n = 0 THEN RAISE EXCEPTION 'FALHA: admin não lê configuração da escala'; END IF;
  RAISE NOTICE 'OK admin lê configuração da escala';
END $$;
RESET ROLE;

ROLLBACK;
\echo 'TODOS OS TESTES PASSARAM'
