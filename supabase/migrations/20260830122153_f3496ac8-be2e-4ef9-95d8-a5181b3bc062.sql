ALTER TABLE public.residentes
  ADD COLUMN IF NOT EXISTS origem_procedencia text,
  ADD COLUMN IF NOT EXISTS origem_procedencia_instituicao text,
  ADD COLUMN IF NOT EXISTS estado_civil text,
  ADD COLUMN IF NOT EXISTS numero_filhos_vivos integer,
  ADD COLUMN IF NOT EXISTS altura_cm numeric,
  ADD COLUMN IF NOT EXISTS peso_kg numeric,
  ADD COLUMN IF NOT EXISTS responsavel_principal_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_principal_parentesco text,
  ADD COLUMN IF NOT EXISTS responsavel_principal_parentesco_outro text,
  ADD COLUMN IF NOT EXISTS responsavel_principal_telefone text,
  ADD COLUMN IF NOT EXISTS data_rescisao_contrato date,
  ADD COLUMN IF NOT EXISTS motivo_rescisao text,
  ADD COLUMN IF NOT EXISTS instituicao_destino text,
  ADD COLUMN IF NOT EXISTS observacoes_rescisao text;

ALTER TABLE public.residentes
  DROP CONSTRAINT IF EXISTS residentes_origem_procedencia_check,
  DROP CONSTRAINT IF EXISTS residentes_estado_civil_check,
  DROP CONSTRAINT IF EXISTS residentes_motivo_rescisao_check,
  DROP CONSTRAINT IF EXISTS residentes_numero_filhos_check;

ALTER TABLE public.residentes
  ADD CONSTRAINT residentes_origem_procedencia_check
    CHECK (origem_procedencia IS NULL OR origem_procedencia IN ('residencia','outra_instituicao')),
  ADD CONSTRAINT residentes_estado_civil_check
    CHECK (estado_civil IS NULL OR estado_civil IN ('solteiro','casado','viuvo','divorciado','uniao_estavel')),
  ADD CONSTRAINT residentes_motivo_rescisao_check
    CHECK (motivo_rescisao IS NULL OR motivo_rescisao IN ('obito','transferencia','volta_residencia')),
  ADD CONSTRAINT residentes_numero_filhos_check
    CHECK (numero_filhos_vivos IS NULL OR numero_filhos_vivos >= 0);

CREATE OR REPLACE FUNCTION public.residentes_aplica_rescisao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE _quarto uuid;
BEGIN
  IF NEW.data_rescisao_contrato IS NOT NULL THEN
    IF NEW.motivo_rescisao IS NULL THEN
      RAISE EXCEPTION 'Informe o motivo da rescisão quando a data de rescisão for preenchida';
    END IF;
    NEW.ativo := false;
    _quarto := NEW.quarto_id;
    NEW.quarto_id := NULL;
    IF _quarto IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.residentes r
        WHERE r.quarto_id = _quarto AND r.ativo = true AND r.id <> NEW.id
      ) THEN
        UPDATE public.quartos SET status = 'vago' WHERE id = _quarto AND status = 'ocupado';
      END IF;
    END IF;
  ELSE
    NEW.motivo_rescisao := NULL;
    NEW.instituicao_destino := NULL;
    NEW.observacoes_rescisao := NULL;
    IF TG_OP = 'UPDATE' AND OLD.data_rescisao_contrato IS NOT NULL THEN
      NEW.ativo := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_residentes_rescisao ON public.residentes;
CREATE TRIGGER trg_residentes_rescisao
BEFORE INSERT OR UPDATE ON public.residentes
FOR EACH ROW EXECUTE FUNCTION public.residentes_aplica_rescisao();