
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','gerente','enfermeiro','cuidador','familia');
CREATE TYPE public.room_status AS ENUM ('ocupado','vago','manutencao');
CREATE TYPE public.resident_status AS ENUM ('estavel','observacao','critico');
CREATE TYPE public.incident_severity AS ENUM ('leve','moderado','grave');
CREATE TYPE public.shift AS ENUM ('manha','tarde','noite');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','gerente','enfermeiro','cuidador')
  );
$$;

-- Trigger: cria profile ao criar usuário, primeiro usuário vira admin, demais viram cuidador
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cuidador');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ QUARTOS ============
CREATE TABLE public.quartos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  ala TEXT,
  capacidade INT NOT NULL DEFAULT 1,
  status public.room_status NOT NULL DEFAULT 'vago',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quartos TO authenticated;
GRANT ALL ON public.quartos TO service_role;
ALTER TABLE public.quartos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quartos_staff_all" ON public.quartos FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ RESIDENTES ============
CREATE TABLE public.residentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo TEXT NOT NULL,
  data_nascimento DATE,
  quarto_id UUID REFERENCES public.quartos(id) ON DELETE SET NULL,
  contato_emergencia_nome TEXT,
  contato_emergencia_telefone TEXT,
  historico_medico TEXT,
  alergias TEXT,
  dieta TEXT,
  status public.resident_status NOT NULL DEFAULT 'estavel',
  ativo BOOLEAN NOT NULL DEFAULT true,
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.residentes TO authenticated;
GRANT ALL ON public.residentes TO service_role;
ALTER TABLE public.residentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "residentes_staff_all" ON public.residentes FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Vínculo família -> residente
CREATE TABLE public.familia_residente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  residente_id UUID NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  parentesco TEXT,
  UNIQUE (user_id, residente_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.familia_residente TO authenticated;
GRANT ALL ON public.familia_residente TO service_role;
ALTER TABLE public.familia_residente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "familia_residente_staff_all" ON public.familia_residente FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "familia_residente_own" ON public.familia_residente FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Família consegue enxergar seu residente
CREATE POLICY "residentes_family_view" ON public.residentes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.familia_residente fr WHERE fr.residente_id = residentes.id AND fr.user_id = auth.uid()));

-- ============ MEDICAMENTOS PRESCRITOS ============
CREATE TABLE public.medicamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id UUID NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  dosagem TEXT NOT NULL,
  via TEXT,
  horarios TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicamentos TO authenticated;
GRANT ALL ON public.medicamentos TO service_role;
ALTER TABLE public.medicamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medicamentos_staff_all" ON public.medicamentos FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "medicamentos_family_view" ON public.medicamentos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.familia_residente fr WHERE fr.residente_id = medicamentos.residente_id AND fr.user_id = auth.uid()));

-- ============ ADMINISTRAÇÕES DE MEDICAMENTOS ============
CREATE TABLE public.administracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicamento_id UUID NOT NULL REFERENCES public.medicamentos(id) ON DELETE CASCADE,
  residente_id UUID NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  administrado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  administrado_por UUID REFERENCES auth.users(id),
  observacoes TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.administracoes TO authenticated;
GRANT ALL ON public.administracoes TO service_role;
ALTER TABLE public.administracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adm_staff_all" ON public.administracoes FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ SINAIS VITAIS ============
CREATE TABLE public.sinais_vitais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id UUID NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  registrado_por UUID REFERENCES auth.users(id),
  pressao_sistolica INT,
  pressao_diastolica INT,
  temperatura NUMERIC(4,1),
  frequencia_cardiaca INT,
  saturacao INT,
  glicemia INT,
  peso NUMERIC(5,2),
  observacoes TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sinais_vitais TO authenticated;
GRANT ALL ON public.sinais_vitais TO service_role;
ALTER TABLE public.sinais_vitais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv_staff_all" ON public.sinais_vitais FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "sv_family_view" ON public.sinais_vitais FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.familia_residente fr WHERE fr.residente_id = sinais_vitais.residente_id AND fr.user_id = auth.uid()));

-- ============ INCIDENTES ============
CREATE TABLE public.incidentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id UUID NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  registrado_por UUID REFERENCES auth.users(id),
  tipo TEXT NOT NULL,
  severidade public.incident_severity NOT NULL DEFAULT 'leve',
  descricao TEXT NOT NULL,
  acao_tomada TEXT,
  resolvido BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidentes TO authenticated;
GRANT ALL ON public.incidentes TO service_role;
ALTER TABLE public.incidentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inc_staff_all" ON public.incidentes FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "inc_family_view" ON public.incidentes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.familia_residente fr WHERE fr.residente_id = incidentes.residente_id AND fr.user_id = auth.uid()));

-- ============ CHECKLIST DIÁRIO ============
CREATE TABLE public.checklist_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id UUID NOT NULL REFERENCES public.residentes(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  turno public.shift NOT NULL,
  tarefa TEXT NOT NULL,
  concluido BOOLEAN NOT NULL DEFAULT false,
  concluido_em TIMESTAMPTZ,
  concluido_por UUID REFERENCES auth.users(id),
  observacoes TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_itens TO authenticated;
GRANT ALL ON public.checklist_itens TO service_role;
ALTER TABLE public.checklist_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ck_staff_all" ON public.checklist_itens FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
