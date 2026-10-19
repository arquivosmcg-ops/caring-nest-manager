CREATE OR REPLACE FUNCTION public.corrigir_recebimento_fraldas(_id uuid, _dados jsonb, _itens jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão expirada'; END IF;
  IF jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN
    RAISE EXCEPTION 'Adicione ao menos um item';
  END IF;
  PERFORM 1 FROM recebimentos_fraldas WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recebimento não encontrado'; END IF;

  UPDATE recebimentos_fraldas SET
    residente_id = (_dados->>'residente_id')::uuid,
    data_entrega = (_dados->>'data_entrega')::date,
    recebido_por = _dados->>'recebido_por',
    forma_entrega = (_dados->>'forma_entrega')::forma_entrega_fralda,
    nome_familiar = NULLIF(_dados->>'nome_familiar',''),
    nome_fornecedor = NULLIF(_dados->>'nome_fornecedor',''),
    origem_correios = NULLIF(_dados->>'origem_correios','')::origem_correios_fralda,
    observacoes = NULLIF(_dados->>'observacoes','')
  WHERE id = _id;

  DELETE FROM recebimentos_fraldas_itens WHERE recebimento_id = _id;
  INSERT INTO recebimentos_fraldas_itens (recebimento_id, produto, marca, tipo, quantidade_fardos, unidades_por_fardo)
  SELECT _id, i->>'produto', i->>'marca', (i->>'tipo')::tipo_fralda,
         COALESCE((i->>'quantidade_fardos')::int,0), COALESCE((i->>'unidades_por_fardo')::int,0)
  FROM jsonb_array_elements(_itens) i;
END;
$$;
REVOKE ALL ON FUNCTION public.corrigir_recebimento_fraldas(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.corrigir_recebimento_fraldas(uuid, jsonb, jsonb) TO authenticated;