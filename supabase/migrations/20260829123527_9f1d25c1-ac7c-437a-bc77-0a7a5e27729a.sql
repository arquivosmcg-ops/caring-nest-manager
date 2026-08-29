CREATE TABLE public.visitantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  documento text,
  grau_parentesco_padrao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitantes TO authenticated;
GRANT ALL ON public.visitantes TO service_role;
ALTER TABLE public.visitantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe gerencia visitantes" ON public.visitantes FOR ALL TO authenticated
  USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

CREATE TABLE public.visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitante_id uuid NOT NULL REFERENCES public.visitantes(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  horario_entrada timestamptz NOT NULL DEFAULT now(),
  horario_saida timestamptz,
  grau_parentesco text,
  recebido_por uuid REFERENCES auth.users(id),
  recebido_por_nome text,
  observacoes text,
  sintomas_gripais boolean,
  temperatura numeric,
  ciente_normas boolean NOT NULL DEFAULT false,
  assinatura_visitante text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_visitas_data ON public.visitas(data DESC);
CREATE INDEX idx_visitas_visitante ON public.visitas(visitante_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitas TO authenticated;
GRANT ALL ON public.visitas TO service_role;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe gerencia visitas" ON public.visitas FOR ALL TO authenticated
  USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

CREATE TABLE public.visitas_residentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id uuid NOT NULL REFERENCES public.visitas(id) ON DELETE CASCADE,
  residente_id uuid NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visita_id, residente_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitas_residentes TO authenticated;
GRANT ALL ON public.visitas_residentes TO service_role;
ALTER TABLE public.visitas_residentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe gerencia residentes visitados" ON public.visitas_residentes FOR ALL TO authenticated
  USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

CREATE TABLE public.config_visitas (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  triagem_ativa boolean NOT NULL DEFAULT true,
  termo_ativo boolean NOT NULL DEFAULT true,
  normas_texto text NOT NULL DEFAULT 'Normas de visitação: respeitar os horários estabelecidos, manter o silêncio nas áreas comuns, não fornecer alimentos ou medicamentos ao residente sem autorização da equipe de enfermagem e comunicar qualquer intercorrência à recepção.',
  alerta_horas integer NOT NULL DEFAULT 4,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.config_visitas TO authenticated;
GRANT ALL ON public.config_visitas TO service_role;
ALTER TABLE public.config_visitas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe consulta configuracoes de visitas" ON public.config_visitas FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));
CREATE POLICY "Admin atualiza configuracoes de visitas" ON public.config_visitas FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
GRANT UPDATE ON public.config_visitas TO authenticated;
INSERT INTO public.config_visitas (id) VALUES (true);

CREATE TRIGGER trg_visitantes_updated BEFORE UPDATE ON public.visitantes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_visitas_updated BEFORE UPDATE ON public.visitas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();