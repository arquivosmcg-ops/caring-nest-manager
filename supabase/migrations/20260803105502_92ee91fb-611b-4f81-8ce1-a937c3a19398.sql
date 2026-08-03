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
  IF length(coalesce(_nova,'')) < 6 THEN
    RAISE EXCEPTION 'A nova palavra-passe deve ter pelo menos 6 caracteres';
  END IF;
  UPDATE public.admin_config
     SET senha_painel_hash = extensions.crypt(_nova, extensions.gen_salt('bf')),
         updated_at = now()
   WHERE id;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redefinir_senha_painel(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redefinir_senha_painel(text) TO authenticated;