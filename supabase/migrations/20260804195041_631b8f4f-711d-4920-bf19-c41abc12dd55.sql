REVOKE ALL ON FUNCTION private.is_multiprofissional(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.pode_ver_prontuario(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prazo_edicao_ok(timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  user_count INT;
  is_first BOOLEAN;
  _funcao text;
  _role public.app_role;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  is_first := user_count <= 1;
  _funcao := lower(coalesce(NEW.raw_user_meta_data->>'funcao',''));

  INSERT INTO public.profiles (id, full_name, email, funcao, registro_profissional, celular, status_aprovacao, aprovado, aprovado_em)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'funcao',''),
    NULLIF(NEW.raw_user_meta_data->>'registro_profissional',''),
    NULLIF(NEW.raw_user_meta_data->>'celular',''),
    CASE WHEN is_first THEN 'aprovado' ELSE 'pendente' END,
    is_first,
    CASE WHEN is_first THEN now() ELSE NULL END
  );

  IF is_first THEN
    _role := 'admin';
  ELSIF EXISTS (SELECT 1 FROM public.categorias_profissionais c WHERE c.chave = _funcao) THEN
    _role := 'multiprofissional';
  ELSE
    _role := 'cuidador';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END;
$function$;
