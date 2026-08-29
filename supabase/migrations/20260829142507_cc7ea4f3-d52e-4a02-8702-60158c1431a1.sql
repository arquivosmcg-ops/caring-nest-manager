DROP POLICY IF EXISTS "residentes_fotos_staff_read" ON storage.objects;
CREATE POLICY "residentes_fotos_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'residentes-fotos' AND private.pode_ver_prontuario(auth.uid()));