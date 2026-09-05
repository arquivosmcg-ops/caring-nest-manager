ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS na_escala boolean NOT NULL DEFAULT true;

UPDATE public.profiles SET na_escala = false
 WHERE lower(btrim(full_name)) IN ('aparecida rodrigues','maria clarete gonçalves');

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
  is_first BOOLEAN;
  _funcao text;
  _role public.app_role;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  is_first := user_count <= 1;
  _funcao := lower(coalesce(NEW.raw_user_meta_data->>'funcao',''));

  INSERT INTO public.profiles (id, full_name, email, funcao, registro_profissional, celular, status_aprovacao, aprovado, aprovado_em, na_escala)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'funcao',''),
    NULLIF(NEW.raw_user_meta_data->>'registro_profissional',''),
    NULLIF(NEW.raw_user_meta_data->>'celular',''),
    CASE WHEN is_first THEN 'aprovado' ELSE 'pendente' END,
    is_first,
    CASE WHEN is_first THEN now() ELSE NULL END,
    COALESCE((NEW.raw_user_meta_data->>'na_escala')::boolean, true)
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

DROP FUNCTION IF EXISTS public.listar_profissionais();

CREATE OR REPLACE FUNCTION public.listar_profissionais()
 RETURNS TABLE(id uuid, full_name text, email text, celular text, funcao text, registro_profissional text, status_aprovacao text, aprovado boolean, created_at timestamp with time zone, roles text[], na_escala boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name, p.email, p.celular, p.funcao, p.registro_profissional,
         p.status_aprovacao, p.aprovado, p.created_at,
         COALESCE(ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.id ORDER BY ur.role::text), '{}'::text[]),
         p.na_escala
  FROM public.profiles p
  WHERE private.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY p.full_name;
$function$;