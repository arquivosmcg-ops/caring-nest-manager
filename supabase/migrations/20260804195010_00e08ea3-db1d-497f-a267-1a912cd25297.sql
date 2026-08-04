-- 1. Novo papel
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'multiprofissional';

-- 2. Categorias profissionais (escalável)
CREATE TABLE public.categorias_profissionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  nome text NOT NULL,
  icone text NOT NULL DEFAULT 'stethoscope',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categorias_profissionais TO authenticated;
GRANT ALL ON public.categorias_profissionais TO service_role;
ALTER TABLE public.categorias_profissionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY cat_prof_read ON public.categorias_profissionais
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.categorias_profissionais (chave, nome, icone) VALUES
  ('fisioterapia','Fisioterapia','activity'),
  ('psicologia','Psicologia','brain'),
  ('nutricao','Nutrição','apple'),
  ('servico_social','Serviço Social','users'),
  ('fonoaudiologia','Fonoaudiologia','ear'),
  ('terapia_ocupacional','Terapia Ocupacional','hand-helping'),
  ('educacao_fisica','Educação Física','dumbbell'),
  ('farmacia_clinica','Farmácia Clínica','pill'),
  ('outro','Outro profissional autorizado','stethoscope');

-- 3. Configuração do prazo de edição
CREATE TABLE public.config_evolucao (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  prazo_edicao_minutos integer NOT NULL DEFAULT 1440,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.config_evolucao TO authenticated;
GRANT UPDATE ON public.config_evolucao TO authenticated;
GRANT ALL ON public.config_evolucao TO service_role;
ALTER TABLE public.config_evolucao ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfg_evo_read ON public.config_evolucao FOR SELECT TO authenticated USING (true);
CREATE POLICY cfg_evo_admin_update ON public.config_evolucao FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
INSERT INTO public.config_evolucao (id) VALUES (true);

-- 4. Helpers
CREATE OR REPLACE FUNCTION private.is_multiprofissional(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'multiprofissional');
$$;

CREATE OR REPLACE FUNCTION private.pode_ver_prontuario(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT private.is_staff(_user_id) OR private.is_multiprofissional(_user_id);
$$;

CREATE OR REPLACE FUNCTION private.prazo_edicao_ok(_criado_em timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _criado_em > now() - (COALESCE((SELECT prazo_edicao_minutos FROM public.config_evolucao WHERE id), 1440) || ' minutes')::interval;
$$;

-- 5. Evoluções multiprofissionais
CREATE TABLE public.evolucoes_multi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id uuid NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL REFERENCES auth.users(id),
  autor_nome text NOT NULL DEFAULT '',
  categoria text NOT NULL,
  conselho_numero text,
  texto text NOT NULL,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  assinatura text,
  editado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_evo_multi_residente ON public.evolucoes_multi(residente_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.evolucoes_multi TO authenticated;
GRANT ALL ON public.evolucoes_multi TO service_role;
ALTER TABLE public.evolucoes_multi ENABLE ROW LEVEL SECURITY;

CREATE POLICY evo_multi_select ON public.evolucoes_multi FOR SELECT TO authenticated
  USING (private.pode_ver_prontuario(auth.uid()));
CREATE POLICY evo_multi_insert ON public.evolucoes_multi FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid() AND private.pode_ver_prontuario(auth.uid()));
CREATE POLICY evo_multi_update_own ON public.evolucoes_multi FOR UPDATE TO authenticated
  USING (autor_id = auth.uid() AND private.prazo_edicao_ok(created_at))
  WITH CHECK (autor_id = auth.uid());

-- autoria imutável
CREATE OR REPLACE FUNCTION public.evolucoes_multi_protege_autoria()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.autor_id := OLD.autor_id;
  NEW.autor_nome := OLD.autor_nome;
  NEW.created_at := OLD.created_at;
  NEW.editado_em := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_evo_multi_autoria BEFORE UPDATE ON public.evolucoes_multi
  FOR EACH ROW EXECUTE FUNCTION public.evolucoes_multi_protege_autoria();

-- 6. Alertas clínicos
CREATE TABLE public.alertas_clinicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id uuid NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  evolucao_id uuid REFERENCES public.evolucoes_multi(id) ON DELETE SET NULL,
  emitido_por uuid NOT NULL REFERENCES auth.users(id),
  emitido_por_nome text NOT NULL DEFAULT '',
  categoria text NOT NULL,
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','visualizado','resolvido')),
  visualizado_em timestamptz,
  resolvido_em timestamptz,
  resolvido_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alertas_status ON public.alertas_clinicos(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.alertas_clinicos TO authenticated;
GRANT ALL ON public.alertas_clinicos TO service_role;
ALTER TABLE public.alertas_clinicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY alertas_select ON public.alertas_clinicos FOR SELECT TO authenticated
  USING (private.pode_ver_prontuario(auth.uid()));
CREATE POLICY alertas_insert ON public.alertas_clinicos FOR INSERT TO authenticated
  WITH CHECK (emitido_por = auth.uid() AND private.pode_ver_prontuario(auth.uid()));
CREATE POLICY alertas_update ON public.alertas_clinicos FOR UPDATE TO authenticated
  USING (private.pode_ver_prontuario(auth.uid())) WITH CHECK (private.pode_ver_prontuario(auth.uid()));

-- 7. Auditoria (append-only)
CREATE TABLE public.auditoria_prontuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  user_nome text,
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id uuid,
  residente_id uuid,
  ip text,
  equipamento text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_auditoria_created ON public.auditoria_prontuario(created_at DESC);
GRANT SELECT, INSERT ON public.auditoria_prontuario TO authenticated;
GRANT ALL ON public.auditoria_prontuario TO service_role;
ALTER TABLE public.auditoria_prontuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_insert ON public.auditoria_prontuario FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY audit_admin_select ON public.auditoria_prontuario FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'));

-- 8. Leitura de residentes/quartos para multiprofissionais
CREATE POLICY residentes_multi_view ON public.residentes FOR SELECT TO authenticated
  USING (private.is_multiprofissional(auth.uid()));
CREATE POLICY quartos_multi_view ON public.quartos FOR SELECT TO authenticated
  USING (private.is_multiprofissional(auth.uid()));

-- 9. Timestamps
CREATE TRIGGER trg_config_evolucao_updated BEFORE UPDATE ON public.config_evolucao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
