ALTER TABLE public.medicamentos
  ADD COLUMN IF NOT EXISTS turnos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS duracao_tipo text NOT NULL DEFAULT 'continuo',
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS numero_dias integer,
  ADD COLUMN IF NOT EXISTS data_fim date,
  ADD COLUMN IF NOT EXISTS se_necessario boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS suspenso_em timestamptz,
  ADD COLUMN IF NOT EXISTS suspenso_por uuid REFERENCES auth.users(id);

ALTER TABLE public.medicamentos
  ADD CONSTRAINT medicamentos_duracao_tipo_chk CHECK (duracao_tipo IN ('continuo','determinado')),
  ADD CONSTRAINT medicamentos_status_chk CHECK (status IN ('ativo','suspenso','encerrado'));

CREATE OR REPLACE FUNCTION public.medicamentos_calc_fim()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.duracao_tipo = 'determinado' AND NEW.data_inicio IS NOT NULL AND NEW.numero_dias IS NOT NULL THEN
    NEW.data_fim := NEW.data_inicio + (NEW.numero_dias - 1);
  ELSIF NEW.duracao_tipo = 'continuo' THEN
    NEW.data_fim := NULL;
    NEW.numero_dias := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_medicamentos_calc_fim ON public.medicamentos;
CREATE TRIGGER trg_medicamentos_calc_fim
BEFORE INSERT OR UPDATE ON public.medicamentos
FOR EACH ROW EXECUTE FUNCTION public.medicamentos_calc_fim();

CREATE TABLE IF NOT EXISTS public.administracoes_medicamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicamento_id uuid NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  residente_id uuid NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  data date NOT NULL,
  turno text,
  administrado boolean NOT NULL DEFAULT true,
  motivo text,
  registrado_por uuid REFERENCES auth.users(id),
  registrado_por_nome text,
  horario timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adm_med_turno_chk CHECK (turno IS NULL OR turno IN ('manha','tarde','noite'))
);

CREATE UNIQUE INDEX IF NOT EXISTS adm_med_unico_turno
  ON public.administracoes_medicamento (medicamento_id, data, turno)
  WHERE turno IS NOT NULL;

CREATE INDEX IF NOT EXISTS adm_med_residente_data ON public.administracoes_medicamento (residente_id, data);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.administracoes_medicamento TO authenticated;
GRANT ALL ON public.administracoes_medicamento TO service_role;

ALTER TABLE public.administracoes_medicamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY adm_med_staff_all ON public.administracoes_medicamento
  FOR ALL TO authenticated
  USING (private.is_staff(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()));

CREATE POLICY adm_med_family_view ON public.administracoes_medicamento
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.familia_residente fr
                 WHERE fr.residente_id = administracoes_medicamento.residente_id
                   AND fr.user_id = auth.uid()));

CREATE TRIGGER trg_adm_med_updated
BEFORE UPDATE ON public.administracoes_medicamento
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();