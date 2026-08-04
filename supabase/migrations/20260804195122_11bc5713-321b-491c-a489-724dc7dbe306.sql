CREATE POLICY "evo_anexos_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'evolucoes-anexos' AND private.pode_ver_prontuario(auth.uid()));
CREATE POLICY "evo_anexos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evolucoes-anexos' AND private.pode_ver_prontuario(auth.uid()));
