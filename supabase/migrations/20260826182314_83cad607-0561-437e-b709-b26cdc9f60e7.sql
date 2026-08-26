CREATE TYPE public.forma_entrega_fralda AS ENUM ('familiar','fornecedor','correios');
CREATE TYPE public.origem_correios_fralda AS ENUM ('governo','outros');
CREATE TYPE public.tipo_fralda AS ENUM ('tradicional','calcinha_pant','absorvente');

CREATE TABLE public.recebimentos_fraldas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id uuid NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  data_entrega date NOT NULL DEFAULT CURRENT_DATE,
  recebido_por text NOT NULL,
  registrado_por uuid REFERENCES auth.users(id),
  forma_entrega public.forma_entrega_fralda NOT NULL,
  nome_familiar text,
  nome_fornecedor text,
  origem_correios public.origem_correios_fralda,
  marca text NOT NULL,
  tipo public.tipo_fralda NOT NULL,
  quantidade_fardos integer NOT NULL DEFAULT 0,
  unidades_por_fardo integer NOT NULL DEFAULT 0,
  total_unidades integer GENERATED ALWAYS AS (quantidade_fardos * unidades_por_fardo) STORED,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recebimentos_fraldas TO authenticated;
GRANT ALL ON public.recebimentos_fraldas TO service_role;

ALTER TABLE public.recebimentos_fraldas ENABLE ROW LEVEL SECURITY;

CREATE POLICY rf_staff_all ON public.recebimentos_fraldas FOR ALL TO authenticated
  USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

CREATE POLICY rf_family_view ON public.recebimentos_fraldas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.familia_residente fr WHERE fr.residente_id = recebimentos_fraldas.residente_id AND fr.user_id = auth.uid()));

CREATE INDEX idx_rf_residente_data ON public.recebimentos_fraldas (residente_id, data_entrega DESC);