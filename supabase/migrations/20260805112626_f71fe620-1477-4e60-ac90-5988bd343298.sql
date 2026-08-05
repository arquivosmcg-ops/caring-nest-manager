-- 1) Prevent self-approval / role escalation on profiles
CREATE OR REPLACE FUNCTION public.profiles_protege_aprovacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF private.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status_aprovacao := 'pendente';
    NEW.aprovado := false;
    NEW.aprovado_em := NULL;
    NEW.aprovado_por := NULL;
  ELSE
    NEW.status_aprovacao := OLD.status_aprovacao;
    NEW.aprovado := OLD.aprovado;
    NEW.aprovado_em := OLD.aprovado_em;
    NEW.aprovado_por := OLD.aprovado_por;
    NEW.funcao := OLD.funcao;
    NEW.registro_profissional := OLD.registro_profissional;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.profiles_protege_aprovacao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_protege_aprovacao ON public.profiles;
CREATE TRIGGER trg_profiles_protege_aprovacao
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_protege_aprovacao();

-- 2) Lock down SECURITY DEFINER functions that must not be callable by clients
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.evolucoes_multi_protege_autoria() FROM PUBLIC, anon, authenticated;

-- Admin-only RPCs: no anon/public access; authenticated callers are re-checked
-- inside each function via private.has_role(auth.uid(),'admin')
REVOKE ALL ON FUNCTION public.alterar_senha_painel(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redefinir_senha_painel(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verificar_senha_painel(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alterar_senha_painel(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redefinir_senha_painel(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_senha_painel(text) TO authenticated;