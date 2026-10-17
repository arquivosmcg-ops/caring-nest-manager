CREATE OR REPLACE FUNCTION public.corrigir_visita_em_andamento(_visita_id uuid, _dados jsonb, _residentes uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v public.visitas%ROWTYPE; visitante public.visitantes%ROWTYPE; novo_visitante uuid; entrada timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para corrigir a visita'; END IF;
  SELECT * INTO v FROM public.visitas WHERE id = _visita_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Visita não encontrada ou acesso não permitido'; END IF;
  IF v.horario_saida IS NOT NULL THEN RAISE EXCEPTION 'Esta visita já foi encerrada. Atualize a página'; END IF;
  IF nullif(trim(_dados->>'nome'), '') IS NULL THEN RAISE EXCEPTION 'Informe o nome do visitante'; END IF;
  IF coalesce(cardinality(_residentes), 0) = 0 THEN RAISE EXCEPTION 'Selecione pelo menos um residente visitado'; END IF;
  entrada := (_dados->>'horario_entrada')::timestamptz;
  IF entrada IS NULL OR nullif(_dados->>'data', '') IS NULL THEN RAISE EXCEPTION 'Informe a data e o horário de entrada'; END IF;
  SELECT * INTO visitante FROM public.visitantes WHERE id = v.visitante_id;
  novo_visitante := v.visitante_id;
  IF visitante.nome IS DISTINCT FROM trim(_dados->>'nome') OR visitante.documento IS DISTINCT FROM nullif(trim(_dados->>'documento'), '') THEN
    INSERT INTO public.visitantes(nome, documento, grau_parentesco_padrao)
    VALUES(trim(_dados->>'nome'), nullif(trim(_dados->>'documento'), ''), _dados->>'grau_parentesco') RETURNING id INTO novo_visitante;
  END IF;
  UPDATE public.visitas SET visitante_id = novo_visitante, data = (_dados->>'data')::date,
    horario_entrada = entrada, grau_parentesco = _dados->>'grau_parentesco',
    observacoes = nullif(trim(_dados->>'observacoes'), ''), sintomas_gripais = (_dados->>'sintomas_gripais')::boolean,
    temperatura = nullif(_dados->>'temperatura', '')::numeric, ciente_normas = (_dados->>'ciente_normas')::boolean,
    assinatura_visitante = _dados->>'assinatura_visitante'
    WHERE id = _visita_id;
  DELETE FROM public.visitas_residentes WHERE visita_id = _visita_id;
  INSERT INTO public.visitas_residentes(visita_id, residente_id)
    SELECT _visita_id, unnest FROM unnest(_residentes) GROUP BY unnest;
END; $$;
REVOKE ALL ON FUNCTION public.corrigir_visita_em_andamento(uuid, jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.corrigir_visita_em_andamento(uuid, jsonb, uuid[]) TO authenticated;