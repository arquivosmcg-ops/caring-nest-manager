-- 1. Campos de assinatura no perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS categoria_assinatura text,
  ADD COLUMN IF NOT EXISTS conselho_uf text,
  ADD COLUMN IF NOT EXISTS pin_hash text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_categoria_assinatura_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_categoria_assinatura_check
  CHECK (categoria_assinatura IS NULL OR categoria_assinatura IN ('enfermeiro','tecnico_enfermagem','medico'));

-- 2. Retificação de SAE (nunca sobrescrever documento assinado)
ALTER TABLE public.sae_registros
  ADD COLUMN IF NOT EXISTS retifica_id uuid REFERENCES public.sae_registros(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_retificacao text;

-- 3. Tabela de assinaturas (imutável)
CREATE TABLE IF NOT EXISTS public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_profissional text NOT NULL,
  categoria_profissional text NOT NULL,
  numero_conselho text,
  conselho_uf text,
  documento_tipo text NOT NULL CHECK (documento_tipo IN ('sae','cuidado_diario','turno','conduta_medica')),
  documento_id uuid NOT NULL,
  documento_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  hash_documento text NOT NULL,
  metodo text NOT NULL DEFAULT 'pin' CHECK (metodo IN ('pin','senha','certificado')),
  certificado_info jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assinaturas_documento ON public.assinaturas (documento_tipo, documento_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_usuario ON public.assinaturas (usuario_id, created_at DESC);

GRANT SELECT ON public.assinaturas TO authenticated;
GRANT ALL ON public.assinaturas TO service_role;

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe autenticada pode consultar assinaturas" ON public.assinaturas;
CREATE POLICY "Equipe autenticada pode consultar assinaturas"
  ON public.assinaturas FOR SELECT TO authenticated USING (true);
-- Sem políticas de INSERT/UPDATE/DELETE: gravação apenas via função segura.

-- 4. PIN pessoal
CREATE OR REPLACE FUNCTION public.definir_pin_assinatura(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4,6}$' THEN
    RAISE EXCEPTION 'O PIN deve conter de 4 a 6 dígitos numéricos';
  END IF;
  UPDATE public.profiles
     SET pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf'))
   WHERE id = auth.uid();
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.tenho_pin_assinatura()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT pin_hash IS NOT NULL FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- 5. Registro de assinatura (única forma de inserir)
CREATE OR REPLACE FUNCTION public.registrar_assinatura(
  _documento_tipo text,
  _documento_id uuid,
  _hash text,
  _pin text DEFAULT NULL,
  _documento_ref jsonb DEFAULT '{}'::jsonb,
  _metodo text DEFAULT 'pin'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _uid uuid := auth.uid();
  _p record;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;
  IF _metodo NOT IN ('pin','senha') THEN
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

  -- Somente enfermagem assina SAE, cuidados e turnos; conduta médica só por médico.
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
    documento_tipo, documento_id, documento_ref, hash_documento, metodo
  ) VALUES (
    _uid, _p.full_name, _p.categoria_assinatura, _p.registro_profissional, _p.conselho_uf,
    _documento_tipo, _documento_id, COALESCE(_documento_ref, '{}'::jsonb), _hash, _metodo
  ) RETURNING id INTO _id;

  INSERT INTO public.auditoria_prontuario (user_id, user_nome, acao, entidade, entidade_id, detalhes)
  VALUES (_uid, _p.full_name, 'assinatura', _documento_tipo, _documento_id,
          jsonb_build_object('hash', _hash, 'metodo', _metodo, 'ref', COALESCE(_documento_ref,'{}'::jsonb)));

  RETURN _id;
END;
$$;

-- 6. Bloqueio de edição de documentos assinados
CREATE OR REPLACE FUNCTION public.bloqueia_documento_assinado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE _tipo text;
BEGIN
  _tipo := TG_ARGV[0];
  IF EXISTS (SELECT 1 FROM public.assinaturas a
              WHERE a.documento_tipo = _tipo AND a.documento_id = OLD.id) THEN
    RAISE EXCEPTION 'Documento já assinado eletronicamente: crie uma retificação em vez de alterar o original';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_sae_bloqueia_assinado ON public.sae_registros;
CREATE TRIGGER trg_sae_bloqueia_assinado
  BEFORE UPDATE OR DELETE ON public.sae_registros
  FOR EACH ROW EXECUTE FUNCTION public.bloqueia_documento_assinado('sae');

DROP TRIGGER IF EXISTS trg_cuidados_bloqueia_assinado ON public.registros_cuidados;
CREATE TRIGGER trg_cuidados_bloqueia_assinado
  BEFORE UPDATE OR DELETE ON public.registros_cuidados
  FOR EACH ROW EXECUTE FUNCTION public.bloqueia_documento_assinado('cuidado_diario');

-- 7. Permissões de execução (nada exposto ao público)
REVOKE ALL ON FUNCTION public.definir_pin_assinatura(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tenho_pin_assinatura() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_assinatura(text, uuid, text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bloqueia_documento_assinado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.definir_pin_assinatura(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenho_pin_assinatura() TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_assinatura(text, uuid, text, text, jsonb, text) TO authenticated;