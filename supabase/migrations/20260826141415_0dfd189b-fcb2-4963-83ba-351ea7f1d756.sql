CREATE TABLE public.sae_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id uuid NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL REFERENCES auth.users(id),
  autor_nome text NOT NULL,
  autor_registro text,
  data date NOT NULL DEFAULT current_date,
  turno shift NOT NULL,
  secoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  evolucao text,
  assinatura text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.sae_registros TO authenticated;
GRANT ALL ON public.sae_registros TO service_role;

ALTER TABLE public.sae_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sae_select_equipe" ON public.sae_registros FOR SELECT TO authenticated
USING (private.is_staff(auth.uid()) OR private.has_role(auth.uid(), 'multiprofissional'::app_role));

CREATE POLICY "sae_insert_equipe" ON public.sae_registros FOR INSERT TO authenticated
WITH CHECK (autor_id = auth.uid() AND (private.is_staff(auth.uid()) OR private.has_role(auth.uid(), 'multiprofissional'::app_role)));

CREATE POLICY "sae_update_autor" ON public.sae_registros FOR UPDATE TO authenticated
USING (autor_id = auth.uid()) WITH CHECK (autor_id = auth.uid());

CREATE TRIGGER trg_sae_updated BEFORE UPDATE ON public.sae_registros
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sae_residente_data ON public.sae_registros (residente_id, data DESC);