CREATE TABLE public.config_fraldas (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  dias_alerta integer NOT NULL DEFAULT 30 CHECK (dias_alerta > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.config_fraldas (id, dias_alerta) VALUES (true, 30);
GRANT SELECT ON public.config_fraldas TO authenticated;
GRANT UPDATE ON public.config_fraldas TO authenticated;
GRANT ALL ON public.config_fraldas TO service_role;
ALTER TABLE public.config_fraldas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe pode ver config de fraldas" ON public.config_fraldas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin atualiza config de fraldas" ON public.config_fraldas FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
CREATE TRIGGER update_config_fraldas_updated_at BEFORE UPDATE ON public.config_fraldas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();