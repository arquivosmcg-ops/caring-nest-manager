-- 1) Helper functions: switch from SECURITY DEFINER to SECURITY INVOKER.
-- All of them only read rows the calling user is already allowed to read
-- (user_roles has a select-own policy; config_evolucao is readable by authenticated).
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','gerente','enfermeiro','cuidador')
  );
$$;

CREATE OR REPLACE FUNCTION private.is_multiprofissional(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'multiprofissional');
$$;

CREATE OR REPLACE FUNCTION private.pode_ver_prontuario(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT private.is_staff(_user_id) OR private.is_multiprofissional(_user_id);
$$;

CREATE OR REPLACE FUNCTION private.prazo_edicao_ok(_criado_em timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT _criado_em > now() - (COALESCE((SELECT prazo_edicao_minutos FROM public.config_evolucao WHERE id), 1440) || ' minutes')::interval;
$$;

-- Policies evaluate as the calling role, so the helpers need EXECUTE.
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_multiprofissional(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.pode_ver_prontuario(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.prazo_edicao_ok(timestamptz) TO authenticated, service_role;

REVOKE ALL ON FUNCTION private.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_multiprofissional(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.pode_ver_prontuario(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.prazo_edicao_ok(timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.validar_forca_senha(text) FROM PUBLIC, anon, authenticated;

-- 2) admin_config: explicitly locked down. No API access at all; only the
-- admin-checked SECURITY DEFINER RPCs (which run as owner) may touch it.
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_config FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.admin_config TO service_role;
COMMENT ON TABLE public.admin_config IS 'Hash da palavra-passe do painel admin. Sem acesso via API: use apenas verificar_senha_painel/alterar_senha_painel/redefinir_senha_painel.';

-- The definer RPCs run as their owner; FORCE RLS would block them, so allow the owner explicitly.
CREATE POLICY admin_config_owner_only ON public.admin_config
  FOR ALL TO postgres USING (true) WITH CHECK (true);

-- 3) administracoes: family members may read records of their own residents.
CREATE POLICY administracoes_family_view ON public.administracoes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.familia_residente fr
    WHERE fr.residente_id = administracoes.residente_id
      AND fr.user_id = auth.uid()
  ));