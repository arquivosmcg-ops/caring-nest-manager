CREATE TABLE public.produtos_fraldas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_produto text NOT NULL UNIQUE,
  unidades_padrao_por_pacote integer NOT NULL,
  marca_sugerida text,
  tipo_sugerido tipo_fralda NOT NULL DEFAULT 'tradicional',
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.produtos_fraldas TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.produtos_fraldas TO authenticated;
GRANT ALL ON public.produtos_fraldas TO service_role;

ALTER TABLE public.produtos_fraldas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtos_fraldas_select" ON public.produtos_fraldas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "produtos_fraldas_admin_insert" ON public.produtos_fraldas
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "produtos_fraldas_admin_update" ON public.produtos_fraldas
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "produtos_fraldas_admin_delete" ON public.produtos_fraldas
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_produtos_fraldas_updated
  BEFORE UPDATE ON public.produtos_fraldas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.produtos_fraldas (nome_produto, unidades_padrao_por_pacote, marca_sugerida, tipo_sugerido, ordem) VALUES
  ('Hiperfral XG com 46', 46, 'Hiperfral', 'tradicional', 1),
  ('Confort Master Pants M com 32', 32, 'Confort Master', 'calcinha_pant', 2),
  ('Tena Pants Confort P/M com 32', 32, 'Tena', 'calcinha_pant', 3),
  ('Tena Pants Demacare P/M com 32', 32, 'Tena', 'calcinha_pant', 4),
  ('Tena Pants Demacare X/XG com 32', 32, 'Tena', 'calcinha_pant', 5),
  ('Suavidade com 30', 30, 'Suavidade', 'tradicional', 6),
  ('Comfort Master EG com 26', 26, 'Confort Master', 'tradicional', 7),
  ('Tena Slip Derma G com 24', 24, 'Tena', 'tradicional', 8),
  ('Tena Slip Noturna com 24', 24, 'Tena', 'tradicional', 9),
  ('Tena Pants Noturna G/EG com 24', 24, 'Tena', 'calcinha_pant', 10),
  ('Absorvente Adultcare Premium com 20', 20, 'Adultcare', 'absorvente', 11),
  ('Suavidade G com 30', 30, 'Suavidade', 'tradicional', 12),
  ('Absorvente Infinity com 50', 50, 'Infinity', 'absorvente', 13);

ALTER TABLE public.recebimentos_fraldas_itens ADD COLUMN produto text;
UPDATE public.recebimentos_fraldas_itens SET produto = marca WHERE produto IS NULL;