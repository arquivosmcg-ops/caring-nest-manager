REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_protege_aprovacao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.listar_profissionais() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.definir_admin(uuid, boolean, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.alterar_senha_painel(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redefinir_senha_painel(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verificar_senha_painel(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.listar_profissionais() TO authenticated;
GRANT EXECUTE ON FUNCTION public.definir_admin(uuid, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alterar_senha_painel(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redefinir_senha_painel(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_senha_painel(text) TO authenticated;