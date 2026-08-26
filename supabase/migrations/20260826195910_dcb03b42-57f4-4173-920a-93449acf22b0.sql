DROP POLICY IF EXISTS "Equipe autenticada pode consultar assinaturas" ON public.assinaturas;
CREATE POLICY "assinaturas_select_equipe" ON public.assinaturas
FOR SELECT TO authenticated
USING (usuario_id = auth.uid() OR private.is_staff(auth.uid()) OR private.has_role(auth.uid(), 'multiprofissional'::app_role));

DROP POLICY IF EXISTS "cfg_evo_read" ON public.config_evolucao;
CREATE POLICY "cfg_evo_read" ON public.config_evolucao
FOR SELECT TO authenticated
USING (private.is_staff(auth.uid()) OR private.has_role(auth.uid(), 'multiprofissional'::app_role));