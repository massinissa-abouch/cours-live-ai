
-- course-media
CREATE POLICY "course-media auth read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'course-media');
CREATE POLICY "course-media owner write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "course-media owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'course-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "course-media owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'course-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- teacher-docs
CREATE POLICY "teacher-docs owner all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'teacher-docs' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'teacher-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ai-uploads
CREATE POLICY "ai-uploads owner all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'ai-uploads' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'ai-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
