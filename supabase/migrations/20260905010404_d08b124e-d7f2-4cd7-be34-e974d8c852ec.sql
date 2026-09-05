REVOKE ALL ON FUNCTION public.listar_profissionais() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_profissionais() TO authenticated;