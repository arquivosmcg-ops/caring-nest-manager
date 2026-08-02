-- 1. celular no perfil
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS celular text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
  is_first BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  is_first := user_count <= 1;

  INSERT INTO public.profiles (id, full_name, email, funcao, registro_profissional, celular, status_aprovacao, aprovado, aprovado_em)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'funcao',''),
    NULLIF(NEW.raw_user_meta_data->>'registro_profissional',''),
    NULLIF(NEW.raw_user_meta_data->>'celular',''),
    CASE WHEN is_first THEN 'aprovado' ELSE 'pendente' END,
    is_first,
    CASE WHEN is_first THEN now() ELSE NULL END
  );

  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cuidador');
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. senha do painel admin
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.admin_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  senha_painel_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_config TO service_role;
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;
-- sem policies: acesso apenas via funções security definer abaixo

INSERT INTO public.admin_config (id, senha_painel_hash)
VALUES (true, extensions.crypt('admin123', extensions.gen_salt('bf')))
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verificar_senha_painel(_senha text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE h text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN false;
  END IF;
  SELECT senha_painel_hash INTO h FROM public.admin_config WHERE id;
  IF h IS NULL THEN RETURN false; END IF;
  RETURN extensions.crypt(_senha, h) = h;
END;
$$;

CREATE OR REPLACE FUNCTION public.alterar_senha_painel(_atual text, _nova text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE h text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a senha do painel';
  END IF;
  IF length(coalesce(_nova,'')) < 6 THEN
    RAISE EXCEPTION 'A nova palavra-passe deve ter pelo menos 6 caracteres';
  END IF;
  SELECT senha_painel_hash INTO h FROM public.admin_config WHERE id;
  IF h IS NULL OR extensions.crypt(_atual, h) <> h THEN
    RETURN false;
  END IF;
  UPDATE public.admin_config
     SET senha_painel_hash = extensions.crypt(_nova, extensions.gen_salt('bf')),
         updated_at = now()
   WHERE id;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verificar_senha_painel(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.alterar_senha_painel(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verificar_senha_painel(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alterar_senha_painel(text, text) TO authenticated;