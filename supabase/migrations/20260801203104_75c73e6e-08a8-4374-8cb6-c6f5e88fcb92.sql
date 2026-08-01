UPDATE public.profiles p
SET status_aprovacao = 'aprovado', aprovado = true, aprovado_em = now()
WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'admin');