CREATE POLICY "course-media public read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'course-media');
DROP POLICY IF EXISTS "course-media auth read" ON storage.objects;