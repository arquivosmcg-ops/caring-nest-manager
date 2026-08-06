
CREATE POLICY roles_admin_select_all ON public.user_roles
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.listar_profissionais()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  celular text,
  funcao text,
  registro_profissional text,
  status_aprovacao text,
  aprovado boolean,
  created_at timestamptz,
  roles text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.celular, p.funcao, p.registro_profissional,
         p.status_aprovacao, p.aprovado, p.created_at,
         COALESCE(ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.id ORDER BY ur.role::text), '{}'::text[])
  FROM public.profiles p
  WHERE private.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY p.full_name;
$$;

REVOKE ALL ON FUNCTION public.listar_profissionais() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_profissionais() TO authenticated;

CREATE OR REPLACE FUNCTION public.definir_admin(
  _user_id uuid,
  _tornar boolean,
  _ip text DEFAULT NULL,
  _equipamento text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _caller_nome text;
  _alvo_nome text;
  _total_admins int;
BEGIN
  IF NOT private.has_role(_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar privilégios';
  END IF;

  SELECT full_name INTO _alvo_nome FROM public.profiles WHERE id = _user_id;
  IF _alvo_nome IS NULL THEN
    RAISE EXCEPTION 'Utilizador não encontrado';
  END IF;
  SELECT full_name INTO _caller_nome FROM public.profiles WHERE id = _caller;

  IF _tornar THEN
    IF _user_id = _caller THEN
      RAISE EXCEPTION 'Não é possível conceder privilégios a si próprio';
    END IF;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.profiles
       SET status_aprovacao = 'aprovado', aprovado = true,
           aprovado_em = COALESCE(aprovado_em, now()), aprovado_por = COALESCE(aprovado_por, _caller)
     WHERE id = _user_id;
  ELSE
    IF _user_id = _caller THEN
      RAISE EXCEPTION 'Não é possível remover os seus próprios privilégios de administrador';
    END IF;
    SELECT count(*) INTO _total_admins FROM public.user_roles WHERE role = 'admin'::app_role;
    IF _total_admins <= 1 THEN
      RAISE EXCEPTION 'O último administrador não pode ser removido';
    END IF;
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'::app_role;
  END IF;

  INSERT INTO public.auditoria_prontuario (user_id, user_nome, acao, entidade, entidade_id, ip, equipamento, detalhes)
  VALUES (
    _caller, _caller_nome, 'edicao', 'privilegios_admin', _user_id, _ip, _equipamento,
    jsonb_build_object(
      'operacao', CASE WHEN _tornar THEN 'promocao' ELSE 'revogacao' END,
      'usuario_alvo_id', _user_id,
      'usuario_alvo_nome', _alvo_nome
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.definir_admin(uuid, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_admin(uuid, boolean, text, text) TO authenticated;
