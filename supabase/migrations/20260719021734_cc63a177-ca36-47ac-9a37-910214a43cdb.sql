-- B1: restrict course/session write access to teachers only
DROP POLICY IF EXISTS c2 ON public.courses;
CREATE POLICY courses_teacher_write ON public.courses
  FOR ALL
  TO authenticated
  USING (auth.uid() = teacher_id AND public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (auth.uid() = teacher_id AND public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS ls2 ON public.live_sessions;
CREATE POLICY sessions_teacher_write ON public.live_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = teacher_id AND public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (auth.uid() = teacher_id AND public.has_role(auth.uid(), 'teacher'));