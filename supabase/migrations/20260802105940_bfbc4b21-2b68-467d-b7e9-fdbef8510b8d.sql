ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id AND p.email IS DISTINCT FROM u.email;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
  is_first BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  is_first := user_count <= 1;

  INSERT INTO public.profiles (id, full_name, email, funcao, registro_profissional, status_aprovacao, aprovado, aprovado_em)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'funcao',''),
    NULLIF(NEW.raw_user_meta_data->>'registro_profissional',''),
    CASE WHEN is_first THEN 'aprovado' ELSE 'pendente' END,
    is_first,
    CASE WHEN is_first THEN now() ELSE NULL END
  );

  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cuidador');
  END IF;
  RETURN NEW;
END;
$function$;