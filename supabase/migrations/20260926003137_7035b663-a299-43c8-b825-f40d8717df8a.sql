CREATE TABLE IF NOT EXISTS public.alertas_equipe_dispensados (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alerta_chave text NOT NULL,
  dispensado_por uuid REFERENCES auth.users(id),
  dispensado_por_nome text,
  dispensado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alerta_chave)
);
GRANT SELECT, INSERT, DELETE ON public.alertas_equipe_dispensados TO authenticated;
GRANT ALL ON public.alertas_equipe_dispensados TO service_role;
ALTER TABLE public.alertas_equipe_dispensados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem dispensas" ON public.alertas_equipe_dispensados FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins registram dispensas" ON public.alertas_equipe_dispensados FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins podem reverter dispensas" ON public.alertas_equipe_dispensados FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));