CREATE TABLE public.saidas_temporarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id uuid NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  saida_em timestamptz NOT NULL,
  acompanhante text NOT NULL,
  motivo text NOT NULL,
  retorno_em timestamptz,
  observacoes text,
  registrado_por uuid,
  registrado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saidas_retorno_apos_saida CHECK (retorno_em IS NULL OR retorno_em >= saida_em)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saidas_temporarias TO authenticated;
GRANT ALL ON public.saidas_temporarias TO service_role;
ALTER TABLE public.saidas_temporarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY saidas_staff_all ON public.saidas_temporarias FOR ALL TO authenticated
  USING (private.is_staff(auth.uid()) OR private.is_multiprofissional(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()) OR private.is_multiprofissional(auth.uid()));
CREATE INDEX saidas_temporarias_residente_idx ON public.saidas_temporarias(residente_id, saida_em DESC);
CREATE TRIGGER saidas_temporarias_updated BEFORE UPDATE ON public.saidas_temporarias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();