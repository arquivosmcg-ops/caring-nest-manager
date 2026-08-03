CREATE OR REPLACE FUNCTION private.validar_forca_senha(_senha text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF length(coalesce(_senha,'')) < 8 THEN
    RAISE EXCEPTION 'A palavra-passe deve ter pelo menos 8 caracteres';
  END IF;
  IF _senha !~ '[A-ZÀ-Þ]' THEN
    RAISE EXCEPTION 'A palavra-passe deve conter pelo menos uma letra maiúscula';
  END IF;
  IF _senha !~ '[a-zà-þ]' THEN
    RAISE EXCEPTION 'A palavra-passe deve conter pelo menos uma letra minúscula';
  END IF;
  IF _senha !~ '[0-9]' THEN
    RAISE EXCEPTION 'A palavra-passe deve conter pelo menos um número';
  END IF;
  IF _senha !~ '[^A-Za-zÀ-þ0-9]' THEN
    RAISE EXCEPTION 'A palavra-passe deve conter pelo menos um símbolo (ex.: ! @ # $)';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.validar_forca_senha(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.alterar_senha_painel(_atual text, _nova text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE h text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a senha do painel';
  END IF;
  PERFORM private.validar_forca_senha(_nova);
  SELECT senha_painel_hash INTO h FROM public.admin_config WHERE id;
  IF h IS NULL OR extensions.crypt(_atual, h) <> h THEN
    RETURN false;
  END IF;
  IF extensions.crypt(_nova, h) = h THEN
    RAISE EXCEPTION 'A nova palavra-passe deve ser diferente da atual';
  END IF;
  UPDATE public.admin_config
     SET senha_painel_hash = extensions.crypt(_nova, extensions.gen_salt('bf')),
         updated_at = now()
   WHERE id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.redefinir_senha_painel(_nova text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem redefinir a senha do painel';
  END IF;
  PERFORM private.validar_forca_senha(_nova);
  UPDATE public.admin_config
     SET senha_painel_hash = extensions.crypt(_nova, extensions.gen_salt('bf')),
         updated_at = now()
   WHERE id;
  RETURN true;
END;
$$;