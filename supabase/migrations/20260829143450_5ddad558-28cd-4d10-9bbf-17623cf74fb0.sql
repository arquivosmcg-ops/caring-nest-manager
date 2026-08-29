CREATE TYPE public.tipo_posse_item AS ENUM ('aluguel','emprestimo','consignacao','proprio_doacao');
CREATE TYPE public.motivo_retirada_item AS ENUM ('fim_contrato','convenio_solicitou','troca_equipamento','obito_saida','outro');
CREATE TYPE public.status_posse_item AS ENUM ('em_uso','retirado');

CREATE TABLE public.retiradas_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_retirada date NOT NULL DEFAULT CURRENT_DATE,
  retirado_por text NOT NULL,
  entregue_por uuid REFERENCES auth.users(id),
  entregue_por_nome text,
  motivo public.motivo_retirada_item NOT NULL,
  motivo_outro_texto text,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retiradas_itens TO authenticated;
GRANT ALL ON public.retiradas_itens TO service_role;
ALTER TABLE public.retiradas_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY rt_staff_all ON public.retiradas_itens FOR ALL TO authenticated
  USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY rt_multi_all ON public.retiradas_itens FOR ALL TO authenticated
  USING (private.is_multiprofissional(auth.uid())) WITH CHECK (private.is_multiprofissional(auth.uid()));
CREATE TRIGGER update_retiradas_itens_updated_at BEFORE UPDATE ON public.retiradas_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.recebimentos_itens_detalhe
  ADD COLUMN tipo_posse public.tipo_posse_item NOT NULL DEFAULT 'proprio_doacao',
  ADD COLUMN data_prevista_retirada date,
  ADD COLUMN retirada_id uuid REFERENCES public.retiradas_itens(id) ON DELETE SET NULL,
  ADD COLUMN data_retirada date,
  ADD COLUMN status_posse public.status_posse_item NOT NULL DEFAULT 'em_uso';

UPDATE public.recebimentos_itens_detalhe
   SET tipo_posse = 'emprestimo',
       data_prevista_retirada = data_prevista_devolucao,
       status_posse = CASE WHEN status = 'devolvido' THEN 'retirado'::public.status_posse_item ELSE 'em_uso'::public.status_posse_item END,
       data_retirada = data_devolucao_real
 WHERE requer_devolucao = true;

ALTER TABLE public.recebimentos_itens_detalhe
  DROP COLUMN requer_devolucao,
  DROP COLUMN data_prevista_devolucao,
  DROP COLUMN data_devolucao_real,
  DROP COLUMN devolvido_para,
  DROP COLUMN status;

CREATE INDEX idx_rid_status_posse ON public.recebimentos_itens_detalhe (status_posse, tipo_posse);

CREATE POLICY rt_family_view ON public.retiradas_itens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recebimentos_itens_detalhe d
    JOIN public.recebimentos_itens r ON r.id = d.recebimento_id
    JOIN public.familia_residente fr ON fr.residente_id = r.residente_id
    WHERE d.retirada_id = retiradas_itens.id AND fr.user_id = auth.uid()
  ));