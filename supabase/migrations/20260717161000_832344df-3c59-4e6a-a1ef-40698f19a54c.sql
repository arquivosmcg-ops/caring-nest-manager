
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE public.prescricoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  residente_id UUID NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INT NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  medico_nome TEXT,
  crm TEXT,
  alergias TEXT,
  hd TEXT,
  andar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (residente_id, mes, ano)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescricoes TO authenticated;
GRANT ALL ON public.prescricoes TO service_role;

ALTER TABLE public.prescricoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prescricoes_staff_all" ON public.prescricoes
  FOR ALL TO authenticated
  USING (private.is_staff(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()));

CREATE TRIGGER trg_prescricoes_updated
  BEFORE UPDATE ON public.prescricoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.medicamentos
  ADD COLUMN prescricao_id UUID REFERENCES public.prescricoes(id) ON DELETE CASCADE,
  ADD COLUMN numero INT,
  ADD COLUMN dias_semana TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN dias_do_mes JSONB NOT NULL DEFAULT '{}'::jsonb;
