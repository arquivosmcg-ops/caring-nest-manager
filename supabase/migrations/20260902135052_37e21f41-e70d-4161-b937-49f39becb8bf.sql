-- Config
CREATE TABLE public.escala_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  min_manha int NOT NULL DEFAULT 2,
  min_tarde int NOT NULL DEFAULT 2,
  min_noite int NOT NULL DEFAULT 2,
  limite_horas_mensal int NOT NULL DEFAULT 220,
  interjornada_horas int NOT NULL DEFAULT 11,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.escala_config TO authenticated;
GRANT UPDATE, INSERT ON public.escala_config TO authenticated;
GRANT ALL ON public.escala_config TO service_role;
ALTER TABLE public.escala_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "escala_config_select" ON public.escala_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "escala_config_update" ON public.escala_config FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'gerente'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'gerente'::app_role));
CREATE POLICY "escala_config_insert" ON public.escala_config FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'gerente'::app_role));
INSERT INTO public.escala_config (id) VALUES (true);

-- Afastamentos
CREATE TABLE public.escala_afastamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'ferias',
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  observacoes text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_afastamentos TO authenticated;
GRANT ALL ON public.escala_afastamentos TO service_role;
ALTER TABLE public.escala_afastamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "afast_select" ON public.escala_afastamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "afast_write" ON public.escala_afastamentos FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'gerente'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'gerente'::app_role));
CREATE TRIGGER trg_afast_updated BEFORE UPDATE ON public.escala_afastamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Turnos
CREATE TABLE public.escala_turnos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  colaborador_nome text,
  setor text NOT NULL DEFAULT 'enfermagem',
  cargo text,
  data date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  tipo_escala text NOT NULL DEFAULT '12x36',
  turno text NOT NULL DEFAULT 'manha',
  status text NOT NULL DEFAULT 'confirmado',
  observacoes text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_escala_turnos_data ON public.escala_turnos (data);
CREATE INDEX idx_escala_turnos_colab ON public.escala_turnos (colaborador_id, data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_turnos TO authenticated;
GRANT ALL ON public.escala_turnos TO service_role;
ALTER TABLE public.escala_turnos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "turnos_select" ON public.escala_turnos FOR SELECT TO authenticated USING (true);
CREATE POLICY "turnos_write" ON public.escala_turnos FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'gerente'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'gerente'::app_role));
CREATE TRIGGER trg_turnos_updated BEFORE UPDATE ON public.escala_turnos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico
CREATE TABLE public.escala_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id uuid,
  acao text NOT NULL,
  user_id uuid,
  user_nome text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.escala_historico TO authenticated;
GRANT ALL ON public.escala_historico TO service_role;
ALTER TABLE public.escala_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hist_select" ON public.escala_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "hist_insert" ON public.escala_historico FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);