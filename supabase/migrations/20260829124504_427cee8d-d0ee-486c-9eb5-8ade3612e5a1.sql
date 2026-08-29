CREATE TYPE public.origem_recebimento_item AS ENUM ('convenio','familiar','fornecedor','correios','outro');
CREATE TYPE public.categoria_item_recebido AS ENUM ('higiene','equipamento','material_medico','outro');
CREATE TYPE public.status_devolucao_item AS ENUM ('em_uso','devolvido');

CREATE TABLE public.recebimentos_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id uuid NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  data_recebimento date NOT NULL DEFAULT current_date,
  recebido_por text NOT NULL,
  registrado_por uuid REFERENCES auth.users(id),
  origem public.origem_recebimento_item NOT NULL,
  nome_convenio text,
  nome_familiar text,
  nome_fornecedor text,
  origem_correios public.origem_correios_fralda,
  origem_outro_texto text,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recebimentos_itens TO authenticated;
GRANT ALL ON public.recebimentos_itens TO service_role;
ALTER TABLE public.recebimentos_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ri_staff_all" ON public.recebimentos_itens FOR ALL TO authenticated
  USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "ri_family_view" ON public.recebimentos_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.familia_residente fr
                 WHERE fr.residente_id = recebimentos_itens.residente_id AND fr.user_id = auth.uid()));

CREATE TABLE public.recebimentos_itens_detalhe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id uuid NOT NULL REFERENCES public.recebimentos_itens(id) ON DELETE CASCADE,
  categoria public.categoria_item_recebido NOT NULL DEFAULT 'outro',
  descricao text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  numero_serie text,
  requer_devolucao boolean NOT NULL DEFAULT false,
  data_prevista_devolucao date,
  status public.status_devolucao_item,
  data_devolucao_real date,
  devolvido_para text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recebimentos_itens_detalhe TO authenticated;
GRANT ALL ON public.recebimentos_itens_detalhe TO service_role;
ALTER TABLE public.recebimentos_itens_detalhe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rid_staff_all" ON public.recebimentos_itens_detalhe FOR ALL TO authenticated
  USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "rid_family_view" ON public.recebimentos_itens_detalhe FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recebimentos_itens r
    JOIN public.familia_residente fr ON fr.residente_id = r.residente_id
    WHERE r.id = recebimentos_itens_detalhe.recebimento_id AND fr.user_id = auth.uid()));

CREATE INDEX idx_ri_residente ON public.recebimentos_itens(residente_id, data_recebimento DESC);
CREATE INDEX idx_rid_recebimento ON public.recebimentos_itens_detalhe(recebimento_id);

CREATE TRIGGER trg_ri_updated BEFORE UPDATE ON public.recebimentos_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rid_updated BEFORE UPDATE ON public.recebimentos_itens_detalhe
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();