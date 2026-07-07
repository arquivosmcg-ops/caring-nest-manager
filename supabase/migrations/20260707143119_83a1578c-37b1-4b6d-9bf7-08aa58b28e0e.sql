
CREATE POLICY "residentes_fotos_staff_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'residentes-fotos' AND private.is_staff(auth.uid()));
CREATE POLICY "residentes_fotos_staff_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'residentes-fotos' AND private.is_staff(auth.uid()));
CREATE POLICY "residentes_fotos_staff_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'residentes-fotos' AND private.is_staff(auth.uid()));
CREATE POLICY "residentes_fotos_staff_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'residentes-fotos' AND private.is_staff(auth.uid()));
