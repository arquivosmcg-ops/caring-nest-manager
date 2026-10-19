CREATE OR REPLACE FUNCTION private.quartos_status_derivado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'manutencao' THEN
    NEW.status := CASE WHEN EXISTS (
      SELECT 1 FROM public.residentes r WHERE r.quarto_id = NEW.id AND r.ativo
    ) THEN 'ocupado'::room_status ELSE 'vago'::room_status END;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.quartos_status_derivado() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER quartos_status_derivado BEFORE INSERT OR UPDATE OF status ON public.quartos
FOR EACH ROW EXECUTE FUNCTION private.quartos_status_derivado();