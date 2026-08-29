CREATE TABLE IF NOT EXISTS public.medicamentos_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_comercial text NOT NULL,
  principio_ativo text,
  apresentacao text,
  forma_farmaceutica text,
  laboratorio text,
  embalagem text,
  origem text NOT NULL DEFAULT 'local' CHECK (origem IN ('local','manual','api')),
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.medicamentos_base TO authenticated;
GRANT ALL ON public.medicamentos_base TO service_role;
ALTER TABLE public.medicamentos_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "base med leitura equipe" ON public.medicamentos_base;
CREATE POLICY "base med leitura equipe" ON public.medicamentos_base
  FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()) OR private.has_role(auth.uid(), 'multiprofissional'::app_role));

DROP POLICY IF EXISTS "base med cadastro equipe" ON public.medicamentos_base;
CREATE POLICY "base med cadastro equipe" ON public.medicamentos_base
  FOR INSERT TO authenticated
  WITH CHECK (private.is_staff(auth.uid()) OR private.has_role(auth.uid(), 'multiprofissional'::app_role));

CREATE INDEX IF NOT EXISTS idx_medicamentos_base_nome ON public.medicamentos_base (lower(nome_comercial));
CREATE INDEX IF NOT EXISTS idx_medicamentos_base_ativo ON public.medicamentos_base (lower(principio_ativo));

CREATE TABLE IF NOT EXISTS public.receituarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id uuid NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  medico_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  medico_nome text NOT NULL,
  medico_conselho text,
  medico_uf text,
  data_emissao date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','assinado')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.receituario_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receituario_id uuid NOT NULL REFERENCES public.receituarios(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 1,
  nome_medicamento text NOT NULL,
  principio_ativo text,
  apresentacao text,
  forma_farmaceutica text,
  laboratorio text,
  posologia text,
  via text,
  turnos text[] NOT NULL DEFAULT '{}',
  se_necessario boolean NOT NULL DEFAULT false,
  duracao_tipo text NOT NULL DEFAULT 'continuo' CHECK (duracao_tipo IN ('continuo','determinado')),
  data_inicio date,
  numero_dias integer,
  quantidade_dispensar text,
  orientacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receituarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receituario_itens TO authenticated;
GRANT ALL ON public.receituarios TO service_role;
GRANT ALL ON public.receituario_itens TO service_role;

ALTER TABLE public.receituarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receituario_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receituarios equipe" ON public.receituarios;
CREATE POLICY "receituarios equipe" ON public.receituarios
  FOR ALL TO authenticated
  USING (private.is_staff(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "receituario itens equipe" ON public.receituario_itens;
CREATE POLICY "receituario itens equipe" ON public.receituario_itens
  FOR ALL TO authenticated
  USING (private.is_staff(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_receituarios_residente ON public.receituarios (residente_id, data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_receituario_itens_rec ON public.receituario_itens (receituario_id);

DROP TRIGGER IF EXISTS trg_receituarios_updated_at ON public.receituarios;
CREATE TRIGGER trg_receituarios_updated_at
  BEFORE UPDATE ON public.receituarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.assinaturas DROP CONSTRAINT IF EXISTS assinaturas_documento_tipo_check;
ALTER TABLE public.assinaturas ADD CONSTRAINT assinaturas_documento_tipo_check
  CHECK (documento_tipo IN ('sae','cuidado_diario','turno','conduta_medica','receituario'));

CREATE OR REPLACE FUNCTION public.receituario_bloqueia_assinado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE _rec uuid;
BEGIN
  IF TG_TABLE_NAME = 'receituarios' THEN
    _rec := OLD.id;
  ELSE
    _rec := OLD.receituario_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.assinaturas a
              WHERE a.documento_tipo = 'receituario' AND a.documento_id = _rec) THEN
    RAISE EXCEPTION 'Receituário já assinado: emita uma nova receita em vez de alterar a original';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.receituario_bloqueia_assinado() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_receituarios_bloqueia ON public.receituarios;
CREATE TRIGGER trg_receituarios_bloqueia
  BEFORE DELETE ON public.receituarios
  FOR EACH ROW EXECUTE FUNCTION public.receituario_bloqueia_assinado();

DROP TRIGGER IF EXISTS trg_receituario_itens_bloqueia ON public.receituario_itens;
CREATE TRIGGER trg_receituario_itens_bloqueia
  BEFORE UPDATE OR DELETE ON public.receituario_itens
  FOR EACH ROW EXECUTE FUNCTION public.receituario_bloqueia_assinado();

INSERT INTO public.medicamentos_base (nome_comercial, principio_ativo, apresentacao, forma_farmaceutica, laboratorio, embalagem, origem) VALUES
('Dipirona Monoidratada','Dipirona sódica','500 mg','Comprimido','Neo Química','Caixa com 20 comprimidos','local'),
('Novalgina','Dipirona sódica','500 mg/mL','Solução oral (gotas)','Sanofi','Frasco 20 mL','local'),
('Paracetamol','Paracetamol','750 mg','Comprimido','EMS','Caixa com 20 comprimidos','local'),
('Tylenol','Paracetamol','500 mg','Comprimido','Janssen','Caixa com 20 comprimidos','local'),
('Ibuprofeno','Ibuprofeno','600 mg','Comprimido revestido','Medley','Caixa com 20 comprimidos','local'),
('Omeprazol','Omeprazol','20 mg','Cápsula','EMS','Caixa com 28 cápsulas','local'),
('Pantoprazol','Pantoprazol sódico','40 mg','Comprimido revestido','Eurofarma','Caixa com 28 comprimidos','local'),
('Losartana Potássica','Losartana potássica','50 mg','Comprimido revestido','Sandoz','Caixa com 30 comprimidos','local'),
('Enalapril','Maleato de enalapril','10 mg','Comprimido','Medley','Caixa com 30 comprimidos','local'),
('Captopril','Captopril','25 mg','Comprimido','EMS','Caixa com 30 comprimidos','local'),
('Anlodipino','Besilato de anlodipino','5 mg','Comprimido','Biosintética','Caixa com 30 comprimidos','local'),
('Hidroclorotiazida','Hidroclorotiazida','25 mg','Comprimido','Neo Química','Caixa com 30 comprimidos','local'),
('Furosemida','Furosemida','40 mg','Comprimido','Hipolabor','Caixa com 20 comprimidos','local'),
('Espironolactona','Espironolactona','25 mg','Comprimido','Searle','Caixa com 30 comprimidos','local'),
('Atenolol','Atenolol','25 mg','Comprimido','EMS','Caixa com 30 comprimidos','local'),
('Carvedilol','Carvedilol','6,25 mg','Comprimido','Eurofarma','Caixa com 30 comprimidos','local'),
('Metoprolol','Succinato de metoprolol','50 mg','Comprimido de liberação prolongada','AstraZeneca','Caixa com 30 comprimidos','local'),
('Sinvastatina','Sinvastatina','20 mg','Comprimido revestido','Medley','Caixa com 30 comprimidos','local'),
('Atorvastatina','Atorvastatina cálcica','20 mg','Comprimido revestido','EMS','Caixa com 30 comprimidos','local'),
('AAS Protect','Ácido acetilsalicílico','100 mg','Comprimido revestido','Sanofi','Caixa com 30 comprimidos','local'),
('Clopidogrel','Clopidogrel','75 mg','Comprimido revestido','Eurofarma','Caixa com 28 comprimidos','local'),
('Marevan','Varfarina sódica','5 mg','Comprimido','Farmoquímica','Caixa com 30 comprimidos','local'),
('Metformina','Cloridrato de metformina','850 mg','Comprimido revestido','Merck','Caixa com 30 comprimidos','local'),
('Glibenclamida','Glibenclamida','5 mg','Comprimido','Neo Química','Caixa com 30 comprimidos','local'),
('Humulin N','Insulina humana NPH','100 UI/mL','Suspensão injetável','Lilly','Frasco 10 mL','local'),
('Humulin R','Insulina humana regular','100 UI/mL','Solução injetável','Lilly','Frasco 10 mL','local'),
('Puran T4','Levotiroxina sódica','50 mcg','Comprimido','Sanofi','Caixa com 30 comprimidos','local'),
('Sertralina','Cloridrato de sertralina','50 mg','Comprimido revestido','EMS','Caixa com 30 comprimidos','local'),
('Escitalopram','Oxalato de escitalopram','10 mg','Comprimido revestido','Eurofarma','Caixa com 30 comprimidos','local'),
('Fluoxetina','Cloridrato de fluoxetina','20 mg','Cápsula','Medley','Caixa com 30 cápsulas','local'),
('Quetiapina','Fumarato de quetiapina','25 mg','Comprimido revestido','Aché','Caixa com 30 comprimidos','local'),
('Risperidona','Risperidona','1 mg','Comprimido revestido','Janssen','Caixa com 20 comprimidos','local'),
('Haloperidol','Haloperidol','1 mg','Comprimido','União Química','Caixa com 20 comprimidos','local'),
('Rivotril','Clonazepam','2 mg','Comprimido','Roche','Caixa com 30 comprimidos','local'),
('Diazepam','Diazepam','5 mg','Comprimido','Teuto','Caixa com 30 comprimidos','local'),
('Donepezila','Cloridrato de donepezila','5 mg','Comprimido revestido','Aché','Caixa com 30 comprimidos','local'),
('Memantina','Cloridrato de memantina','10 mg','Comprimido revestido','Torrent','Caixa com 30 comprimidos','local'),
('Prolopa','Levodopa + benserazida','200/50 mg','Comprimido','Roche','Caixa com 30 comprimidos','local'),
('Depakene','Valproato de sódio','250 mg','Cápsula','Abbott','Caixa com 50 cápsulas','local'),
('Hidantal','Fenitoína sódica','100 mg','Comprimido','Sanofi','Caixa com 25 comprimidos','local'),
('Amoxicilina','Amoxicilina','500 mg','Cápsula','EMS','Caixa com 21 cápsulas','local'),
('Clavulin','Amoxicilina + clavulanato de potássio','875/125 mg','Comprimido revestido','Eurofarma','Caixa com 14 comprimidos','local'),
('Azitromicina','Azitromicina di-hidratada','500 mg','Comprimido revestido','Medley','Caixa com 5 comprimidos','local'),
('Ciprofloxacino','Cloridrato de ciprofloxacino','500 mg','Comprimido revestido','Neo Química','Caixa com 14 comprimidos','local'),
('Cefalexina','Cefalexina','500 mg','Cápsula','Teuto','Caixa com 8 cápsulas','local'),
('Metronidazol','Metronidazol','250 mg','Comprimido','Prati-Donaduzzi','Caixa com 20 comprimidos','local'),
('Nistatina','Nistatina','100.000 UI/mL','Suspensão oral','Teuto','Frasco 50 mL','local'),
('Fluconazol','Fluconazol','150 mg','Cápsula','EMS','Caixa com 1 cápsula','local'),
('Bromoprida','Bromoprida','10 mg','Comprimido','Aché','Caixa com 20 comprimidos','local'),
('Ondansetrona','Cloridrato de ondansetrona','4 mg','Comprimido revestido','Cristália','Caixa com 10 comprimidos','local'),
('Luftal','Simeticona','75 mg/mL','Solução oral (gotas)','Reckitt','Frasco 15 mL','local'),
('Lactulose','Lactulose','667 mg/mL','Xarope','Sanofi','Frasco 120 mL','local'),
('Dulcolax','Bisacodil','5 mg','Drágea','Boehringer','Caixa com 20 drágeas','local'),
('Óleo Mineral','Óleo mineral','100%','Solução oral','Farmax','Frasco 100 mL','local'),
('Aerolin','Sulfato de salbutamol','100 mcg/dose','Aerossol inalatório','GSK','Frasco 200 doses','local'),
('Budesonida','Budesonida','32 mcg/dose','Spray nasal','Aché','Frasco 120 doses','local'),
('Prednisona','Prednisona','20 mg','Comprimido','Medley','Caixa com 10 comprimidos','local'),
('Dexametasona','Dexametasona','4 mg','Comprimido','Prati-Donaduzzi','Caixa com 10 comprimidos','local'),
('Loratadina','Loratadina','10 mg','Comprimido','EMS','Caixa com 12 comprimidos','local'),
('Tramal','Cloridrato de tramadol','50 mg','Cápsula','Cristália','Caixa com 10 cápsulas','local'),
('Dimorf','Sulfato de morfina','10 mg','Comprimido','Cristália','Caixa com 20 comprimidos','local'),
('Colecalciferol','Vitamina D3','7.000 UI','Cápsula','Marjan','Caixa com 8 cápsulas','local'),
('Calcium D3','Carbonato de cálcio + colecalciferol','500 mg/400 UI','Comprimido revestido','EMS','Caixa com 60 comprimidos','local'),
('Sulfato Ferroso','Sulfato ferroso','40 mg Fe','Comprimido revestido','Hipolabor','Caixa com 30 comprimidos','local'),
('Complexo B','Vitaminas do complexo B','—','Comprimido revestido','Neo Química','Caixa com 60 comprimidos','local'),
('Cianocobalamina','Vitamina B12','1.000 mcg/mL','Solução injetável','Hipolabor','Caixa com 5 ampolas','local'),
('Soro Fisiológico 0,9%','Cloreto de sódio','0,9%','Solução','Fresenius','Frasco 500 mL','local'),
('Dersani','Ácidos graxos essenciais (AGE)','—','Solução tópica','Daudt','Frasco 200 mL','local')
ON CONFLICT DO NOTHING;