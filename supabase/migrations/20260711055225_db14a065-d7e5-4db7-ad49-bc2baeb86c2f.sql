
-- ============ PARTIE A: Live sessions extras ============

-- Close quizzes and store summaries
ALTER TABLE public.session_quizzes ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE public.session_bookings ADD COLUMN IF NOT EXISTS left_at timestamptz;
ALTER TABLE public.session_bookings ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'solo' CHECK (mode IN ('solo','group'));

CREATE TABLE IF NOT EXISTS public.session_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  summary_markdown text NOT NULL,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  per_student jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_summaries TO authenticated;
GRANT ALL ON public.session_summaries TO service_role;
ALTER TABLE public.session_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teacher can manage own session summaries" ON public.session_summaries
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id AND s.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = session_id AND s.teacher_id = auth.uid()));

CREATE POLICY "Participants can view summary" ON public.session_summaries
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.session_bookings b WHERE b.session_id = session_summaries.session_id AND b.student_id = auth.uid()));

-- Realtime for live features
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_quizzes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_responses;
ALTER TABLE public.session_bookings REPLICA IDENTITY FULL;
ALTER TABLE public.session_quizzes REPLICA IDENTITY FULL;
ALTER TABLE public.quiz_responses REPLICA IDENTITY FULL;

-- ============ PARTIE B: AI module ============

DO $$ BEGIN
  CREATE TYPE public.ai_conversation_mode AS ENUM ('chat','exam');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nouvelle conversation',
  subject text,
  level text,
  chapter text,
  mode public.ai_conversation_mode NOT NULL DEFAULT 'chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own conversations" ON public.ai_conversations
  FOR ALL TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE TRIGGER trg_ai_conv_updated BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  parts jsonb,
  image_url text,
  hint_level int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON public.ai_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Messages of own conversations" ON public.ai_messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.student_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.student_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.ai_revision_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  title text NOT NULL,
  subject text,
  chapter text,
  content_markdown text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_revision_sheets TO authenticated;
GRANT ALL ON public.ai_revision_sheets TO service_role;
ALTER TABLE public.ai_revision_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own revision sheets" ON public.ai_revision_sheets
  FOR ALL TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.ai_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  level text,
  chapter text,
  duration_min int NOT NULL DEFAULT 20,
  questions jsonb NOT NULL,
  answers jsonb,
  grading jsonb,
  score numeric,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_exams TO authenticated;
GRANT ALL ON public.ai_exams TO service_role;
ALTER TABLE public.ai_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own exams" ON public.ai_exams
  FOR ALL TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
