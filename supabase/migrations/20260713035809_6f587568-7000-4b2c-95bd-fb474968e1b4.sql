
CREATE POLICY "Group members read resources storage"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'group-resources'
  AND public.is_group_member(((storage.foldername(name))[1])::uuid, auth.uid())
);
CREATE POLICY "Group members upload resources"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'group-resources'
  AND public.is_group_member(((storage.foldername(name))[1])::uuid, auth.uid())
);
CREATE POLICY "Group members delete resources"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'group-resources'
  AND public.is_group_member(((storage.foldername(name))[1])::uuid, auth.uid())
);
