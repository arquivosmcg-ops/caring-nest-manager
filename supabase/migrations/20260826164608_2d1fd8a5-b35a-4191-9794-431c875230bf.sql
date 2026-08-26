REVOKE EXECUTE ON FUNCTION public.definir_pin_assinatura(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.tenho_pin_assinatura() FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_assinatura(text, uuid, text, text, jsonb, text) FROM anon;