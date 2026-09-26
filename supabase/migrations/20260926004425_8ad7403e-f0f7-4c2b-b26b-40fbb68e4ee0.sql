GRANT SELECT ON public.produtos_fraldas TO anon;
CREATE POLICY produtos_fraldas_select_anon ON public.produtos_fraldas FOR SELECT TO anon USING (true);