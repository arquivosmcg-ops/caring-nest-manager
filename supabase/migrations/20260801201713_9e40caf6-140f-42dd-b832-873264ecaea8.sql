
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS funcao text,
  ADD COLUMN IF NOT EXISTS registro_profissional text,
  ADD COLUMN IF NOT EXISTS status_aprovacao text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS aprovado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_funcao_check CHECK (funcao IS NULL OR funcao IN ('medico','enfermeira'));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_aprovacao_check CHECK (status_aprovacao IN ('pendente','aprovado','rejeitado'));

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

  INSERT INTO public.profiles (id, full_name, funcao, registro_profissional, status_aprovacao, aprovado, aprovado_em)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY profiles_admin_select_all ON public.profiles
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

CREATE POLICY profiles_admin_update_all ON public.profiles
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
