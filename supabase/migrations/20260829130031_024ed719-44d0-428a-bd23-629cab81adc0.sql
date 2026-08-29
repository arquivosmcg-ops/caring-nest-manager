CREATE TABLE public.recebimentos_fraldas_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id uuid NOT NULL REFERENCES public.recebimentos_fraldas(id) ON DELETE CASCADE,
  marca text NOT NULL,
  tipo tipo_fralda NOT NULL,
  quantidade_fardos integer NOT NULL DEFAULT 0,
  unidades_por_fardo integer NOT NULL DEFAULT 0,
  total_unidades integer GENERATED ALWAYS AS (quantidade_fardos * unidades_por_fardo) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recebimentos_fraldas_itens TO authenticated;
GRANT ALL ON public.recebimentos_fraldas_itens TO service_role;

ALTER TABLE public.recebimentos_fraldas_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe gerencia itens de fraldas"
ON public.recebimentos_fraldas_itens FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.recebimentos_fraldas rf WHERE rf.id = recebimento_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.recebimentos_fraldas rf WHERE rf.id = recebimento_id));

CREATE INDEX idx_recebimentos_fraldas_itens_recebimento ON public.recebimentos_fraldas_itens(recebimento_id);

CREATE TRIGGER update_recebimentos_fraldas_itens_updated_at
BEFORE UPDATE ON public.recebimentos_fraldas_itens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.recebimentos_fraldas_itens (recebimento_id, marca, tipo, quantidade_fardos, unidades_por_fardo)
SELECT id, marca, tipo, COALESCE(quantidade_fardos, 0), COALESCE(unidades_por_fardo, 0)
FROM public.recebimentos_fraldas;

ALTER TABLE public.recebimentos_fraldas
  DROP COLUMN total_unidades,
  DROP COLUMN marca,
  DROP COLUMN tipo,
  DROP COLUMN quantidade_fardos,
  DROP COLUMN unidades_por_fardo;