-- 1) profiles: add WITH CHECK to self-update policy
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND status_aprovacao = (SELECT p.status_aprovacao FROM public.profiles p WHERE p.id = auth.uid())
    AND aprovado IS NOT DISTINCT FROM (SELECT p.aprovado FROM public.profiles p WHERE p.id = auth.uid())
    AND aprovado_por IS NOT DISTINCT FROM (SELECT p.aprovado_por FROM public.profiles p WHERE p.id = auth.uid())
    AND funcao IS NOT DISTINCT FROM (SELECT p.funcao FROM public.profiles p WHERE p.id = auth.uid())
    AND registro_profissional IS NOT DISTINCT FROM (SELECT p.registro_profissional FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 2) revoke EXECUTE on SECURITY DEFINER trigger functions from API roles
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_protege_aprovacao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.evolucoes_multi_protege_autoria() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 3) admin password RPCs: only authenticated (never anon), keep internal admin checks
REVOKE ALL ON FUNCTION public.alterar_senha_painel(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redefinir_senha_painel(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verificar_senha_painel(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alterar_senha_painel(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redefinir_senha_painel(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_senha_painel(text) TO authenticated;