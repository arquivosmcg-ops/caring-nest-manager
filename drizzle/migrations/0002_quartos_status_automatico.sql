CREATE OR REPLACE FUNCTION private.atualizar_status_quarto(_quarto uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.quartos q
     SET status = CASE WHEN EXISTS (
           SELECT 1 FROM public.residentes r WHERE r.quarto_id = q.id AND r.ativo
         ) THEN 'ocupado'::room_status ELSE 'vago'::room_status END
   WHERE q.id = _quarto AND q.status <> 'manutencao';
$$;
REVOKE ALL ON FUNCTION private.atualizar_status_quarto(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.residentes_sync_quarto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.quarto_id IS NOT NULL THEN
    PERFORM private.atualizar_status_quarto(OLD.quarto_id);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.quarto_id IS NOT NULL THEN
    PERFORM private.atualizar_status_quarto(NEW.quarto_id);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.residentes_sync_quarto() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER residentes_sync_quarto
AFTER INSERT OR DELETE OR UPDATE OF quarto_id, ativo ON public.residentes
FOR EACH ROW EXECUTE FUNCTION private.residentes_sync_quarto();

UPDATE public.quartos q
   SET status = CASE WHEN EXISTS (
         SELECT 1 FROM public.residentes r WHERE r.quarto_id = q.id AND r.ativo
       ) THEN 'ocupado'::room_status ELSE 'vago'::room_status END
 WHERE q.status <> 'manutencao';