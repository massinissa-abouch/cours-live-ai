
CREATE POLICY "sb4_teacher_cancel" ON public.session_bookings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_bookings.session_id AND s.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_bookings.session_id AND s.teacher_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.bump_enrolled_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.courses SET enrolled_count = enrolled_count + 1 WHERE id = NEW.course_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.courses SET enrolled_count = GREATEST(enrolled_count - 1, 0) WHERE id = OLD.course_id;
  END IF;
  RETURN NULL;
END;$$;

DROP TRIGGER IF EXISTS trg_enrolled_count ON public.course_enrollments;
CREATE TRIGGER trg_enrolled_count
  AFTER INSERT OR DELETE ON public.course_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.bump_enrolled_count();

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_session_status ON public.session_bookings(session_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_teacher_time ON public.live_sessions(teacher_id, scheduled_at);
