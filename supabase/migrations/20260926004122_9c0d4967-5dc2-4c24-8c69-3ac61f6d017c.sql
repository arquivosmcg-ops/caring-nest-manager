DROP POLICY IF EXISTS hist_insert ON public.escala_historico;
CREATE POLICY hist_insert ON public.escala_historico FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS hist_select ON public.escala_historico;
CREATE POLICY hist_select ON public.escala_historico FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin'::app_role, 'gerente'::app_role)
    )
  );