-- Recebimento de fraldas
CREATE POLICY rf_multi_all ON public.recebimentos_fraldas FOR ALL TO authenticated
  USING (private.is_multiprofissional(auth.uid()))
  WITH CHECK (private.is_multiprofissional(auth.uid()));

CREATE POLICY rfi_multi_all ON public.recebimentos_fraldas_itens FOR ALL TO authenticated
  USING (private.is_multiprofissional(auth.uid()))
  WITH CHECK (private.is_multiprofissional(auth.uid()));

-- Recebimento de itens e materiais
CREATE POLICY ri_multi_all ON public.recebimentos_itens FOR ALL TO authenticated
  USING (private.is_multiprofissional(auth.uid()))
  WITH CHECK (private.is_multiprofissional(auth.uid()));

CREATE POLICY rid_multi_all ON public.recebimentos_itens_detalhe FOR ALL TO authenticated
  USING (private.is_multiprofissional(auth.uid()))
  WITH CHECK (private.is_multiprofissional(auth.uid()));

-- Controle de visitas
CREATE POLICY visitantes_multi_all ON public.visitantes FOR ALL TO authenticated
  USING (private.is_multiprofissional(auth.uid()))
  WITH CHECK (private.is_multiprofissional(auth.uid()));

CREATE POLICY visitas_multi_all ON public.visitas FOR ALL TO authenticated
  USING (private.is_multiprofissional(auth.uid()))
  WITH CHECK (private.is_multiprofissional(auth.uid()));

CREATE POLICY visitas_residentes_multi_all ON public.visitas_residentes FOR ALL TO authenticated
  USING (private.is_multiprofissional(auth.uid()))
  WITH CHECK (private.is_multiprofissional(auth.uid()));

CREATE POLICY config_visitas_multi_select ON public.config_visitas FOR SELECT TO authenticated
  USING (private.is_multiprofissional(auth.uid()));