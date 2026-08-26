CREATE TABLE public.plano_cuidados (
  id uuid primary key default gen_random_uuid(),
  residente_id uuid references public.residentes(id) on delete cascade,
  numero int not null,
  descricao text not null,
  turnos_aplicaveis shift[] not null default '{manha,tarde,noite}',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
CREATE INDEX idx_plano_cuidados_res ON public.plano_cuidados(residente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_cuidados TO authenticated;
GRANT ALL ON public.plano_cuidados TO service_role;
ALTER TABLE public.plano_cuidados ENABLE ROW LEVEL SECURITY;
CREATE POLICY plano_select ON public.plano_cuidados FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY plano_write ON public.plano_cuidados FOR ALL TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

CREATE TABLE public.registros_cuidados (
  id uuid primary key default gen_random_uuid(),
  residente_id uuid not null references public.residentes(id) on delete cascade,
  cuidado_id uuid not null references public.plano_cuidados(id) on delete cascade,
  data date not null,
  turno shift not null,
  feito_em timestamptz not null default now(),
  responsavel_id uuid references auth.users(id),
  responsavel_nome text,
  observacao text,
  created_at timestamptz not null default now(),
  unique (residente_id, cuidado_id, data, turno)
);
CREATE INDEX idx_reg_cuidados_res_data ON public.registros_cuidados(residente_id, data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registros_cuidados TO authenticated;
GRANT ALL ON public.registros_cuidados TO service_role;
ALTER TABLE public.registros_cuidados ENABLE ROW LEVEL SECURITY;
CREATE POLICY reg_cuidados_select ON public.registros_cuidados FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY reg_cuidados_insert ON public.registros_cuidados FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()) AND responsavel_id = auth.uid());
CREATE POLICY reg_cuidados_update ON public.registros_cuidados FOR UPDATE TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY reg_cuidados_delete ON public.registros_cuidados FOR DELETE TO authenticated USING (private.is_staff(auth.uid()));

CREATE TABLE public.diagnosticos_enfermagem (
  id uuid primary key default gen_random_uuid(),
  residente_id uuid not null references public.residentes(id) on delete cascade,
  mes int not null,
  ano int not null,
  diagnosticos text[] not null default '{}',
  outros_texto text,
  assinatura_enfermeira text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (residente_id, mes, ano)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnosticos_enfermagem TO authenticated;
GRANT ALL ON public.diagnosticos_enfermagem TO service_role;
ALTER TABLE public.diagnosticos_enfermagem ENABLE ROW LEVEL SECURITY;
CREATE POLICY diag_select ON public.diagnosticos_enfermagem FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY diag_write ON public.diagnosticos_enfermagem FOR ALL TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));
CREATE TRIGGER trg_diag_updated BEFORE UPDATE ON public.diagnosticos_enfermagem FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plano_cuidados (residente_id, numero, descricao, turnos_aplicaveis) VALUES
 (NULL,1,'Administrar os medicamentos conforme prescrição médica (VO)','{manha,tarde,noite}'),
 (NULL,2,'Encaminhar para banho de aspersão e/ou leito + hidratação corporal','{manha}'),
 (NULL,3,'Incentivar e encaminhar para banho de sol por 20 minutos','{manha}'),
 (NULL,4,'Observar/anotar/comunicar alteração na ingesta alimentar e hídrica','{manha,tarde,noite}'),
 (NULL,5,'Observar/anotar/comunicar alteração nas eliminações fisiológicas (odor, coloração, quantidade, consistência)','{manha,tarde,noite}'),
 (NULL,6,'Verificar/anotar/comunicar alterações de PA, temperatura ou glicemia (PA ≥150/≤90, Tº ≥37,8/≤34, DX ≥180/≤70)','{manha,tarde,noite}'),
 (NULL,7,'Encaminhar residente para higiene oral','{manha,tarde,noite}'),
 (NULL,8,'Observar/comunicar alteração de comportamento (agressividade, choro, apatia, isolamento, irritabilidade)','{manha,tarde,noite}'),
 (NULL,9,'Observar/anotar/comunicar constipação há mais de 2 dias','{manha,tarde,noite}'),
 (NULL,10,'Observar/comunicar alteração do sono noturno','{noite}'),
 (NULL,11,'Incentivar convívio social e participação em atividades','{manha,tarde}');