CREATE OR REPLACE FUNCTION private.pode_cadastrar_residente(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
 SELECT _user_id = auth.uid() AND EXISTS (
   SELECT 1 FROM public.profiles p
   WHERE p.id = _user_id AND p.funcao = 'outro' AND p.status_aprovacao = 'aprovado'
 ) AND private.is_multiprofissional(_user_id);
$$;
REVOKE ALL ON FUNCTION private.pode_cadastrar_residente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pode_cadastrar_residente(uuid) TO authenticated, service_role;
CREATE POLICY residentes_outros_insert ON public.residentes FOR INSERT TO authenticated WITH CHECK (private.pode_cadastrar_residente(auth.uid()));
CREATE POLICY residentes_outros_update ON public.residentes FOR UPDATE TO authenticated USING (private.pode_cadastrar_residente(auth.uid())) WITH CHECK (private.pode_cadastrar_residente(auth.uid()));
CREATE POLICY residentes_fotos_outros_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'residentes-fotos' AND private.pode_cadastrar_residente(auth.uid()));
CREATE POLICY residentes_fotos_outros_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'residentes-fotos' AND private.pode_cadastrar_residente(auth.uid())) WITH CHECK (bucket_id = 'residentes-fotos' AND private.pode_cadastrar_residente(auth.uid()));