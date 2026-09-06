ALTER TABLE public.assinaturas DROP CONSTRAINT IF EXISTS assinaturas_metodo_check;
ALTER TABLE public.assinaturas ADD CONSTRAINT assinaturas_metodo_check
  CHECK (metodo = ANY (ARRAY['pin','senha','certificado','icp_a1','icp_a3','govbr']));

ALTER TABLE public.certificados_digitais DROP CONSTRAINT IF EXISTS certificados_digitais_tipo_check;
ALTER TABLE public.certificados_digitais ADD CONSTRAINT certificados_digitais_tipo_check
  CHECK (tipo = ANY (ARRAY['A1','A3','GOVBR']));

CREATE OR REPLACE FUNCTION public.registrar_assinatura(_documento_tipo text, _documento_id uuid, _hash text, _pin text DEFAULT NULL::text, _documento_ref jsonb DEFAULT '{}'::jsonb, _metodo text DEFAULT 'pin'::text, _certificado jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _p record;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;
  IF _metodo NOT IN ('pin','senha','icp_a1','icp_a3','govbr') THEN
    RAISE EXCEPTION 'Método de assinatura inválido';
  END IF;
  IF _hash IS NULL OR length(_hash) < 16 THEN
    RAISE EXCEPTION 'Hash do documento inválido';
  END IF;

  SELECT full_name, categoria_assinatura, registro_profissional, conselho_uf, pin_hash
    INTO _p FROM public.profiles WHERE id = _uid;

  IF _p IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;
  IF _p.categoria_assinatura IS NULL THEN
    RAISE EXCEPTION 'Complete os dados de assinatura (categoria profissional e conselho) antes de assinar';
  END IF;

  IF _metodo = 'pin' THEN
    IF _p.pin_hash IS NULL THEN
      RAISE EXCEPTION 'Cadastre um PIN de assinatura antes de assinar';
    END IF;
    IF _pin IS NULL OR extensions.crypt(_pin, _p.pin_hash) <> _p.pin_hash THEN
      RAISE EXCEPTION 'PIN incorreto';
    END IF;
  END IF;

  IF _metodo IN ('icp_a1','icp_a3','govbr') THEN
    IF _certificado IS NULL OR COALESCE(_certificado->>'protocolo','') = '' THEN
      RAISE EXCEPTION 'Dados da assinatura digital ausentes';
    END IF;
    IF (_certificado->>'valido_ate') IS NOT NULL
       AND (_certificado->>'valido_ate')::timestamptz < now() THEN
      RAISE EXCEPTION 'Certificado digital vencido';
    END IF;
  END IF;

  IF _documento_tipo IN ('sae','cuidado_diario','turno')
     AND _p.categoria_assinatura NOT IN ('enfermeiro','tecnico_enfermagem') THEN
    RAISE EXCEPTION 'Apenas enfermeiros e técnicos de enfermagem podem assinar este documento';
  END IF;
  IF _documento_tipo = 'sae' AND _p.categoria_assinatura <> 'enfermeiro' THEN
    RAISE EXCEPTION 'A SAE deve ser assinada pelo enfermeiro responsável';
  END IF;
  IF _documento_tipo = 'conduta_medica' AND _p.categoria_assinatura <> 'medico' THEN
    RAISE EXCEPTION 'Apenas médicos podem assinar condutas médicas';
  END IF;

  INSERT INTO public.assinaturas (
    usuario_id, nome_profissional, categoria_profissional, numero_conselho, conselho_uf,
    documento_tipo, documento_id, documento_ref, hash_documento, metodo,
    certificado_info, certificado_tipo, certificado_ac_emissor, protocolo_assinatura, certificado_valido_ate
  ) VALUES (
    _uid, _p.full_name, _p.categoria_assinatura, _p.registro_profissional, _p.conselho_uf,
    _documento_tipo, _documento_id, COALESCE(_documento_ref, '{}'::jsonb), _hash, _metodo,
    _certificado,
    _certificado->>'tipo',
    _certificado->>'ac_emissora',
    _certificado->>'protocolo',
    NULLIF(_certificado->>'valido_ate','')::timestamptz
  ) RETURNING id INTO _id;

  INSERT INTO public.auditoria_prontuario (user_id, user_nome, acao, entidade, entidade_id, detalhes)
  VALUES (_uid, _p.full_name, 'assinatura', _documento_tipo, _documento_id,
          jsonb_build_object('hash', _hash, 'metodo', _metodo, 'ref', COALESCE(_documento_ref,'{}'::jsonb),
                             'certificado', COALESCE(_certificado, '{}'::jsonb)));

  RETURN _id;
END;
$function$;