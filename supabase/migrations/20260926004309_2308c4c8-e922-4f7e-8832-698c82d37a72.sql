DROP POLICY IF EXISTS turnos_select ON public.escala_turnos;
CREATE POLICY turnos_select ON public.escala_turnos FOR SELECT TO authenticated
USING (colaborador_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'gerente'::app_role));

DROP POLICY IF EXISTS afast_select ON public.escala_afastamentos;
CREATE POLICY afast_select ON public.escala_afastamentos FOR SELECT TO authenticated
USING (colaborador_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'gerente'::app_role));

DROP POLICY IF EXISTS escala_config_select ON public.escala_config;
CREATE POLICY escala_config_select ON public.escala_config FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'gerente'::app_role));