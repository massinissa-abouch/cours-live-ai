
-- Fiches Mémo Express
CREATE TABLE public.memo_sheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  level TEXT,
  chapter TEXT,
  source_text TEXT,
  source_kind TEXT NOT NULL DEFAULT 'text',
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  formats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memo_sheets TO authenticated;
GRANT ALL ON public.memo_sheets TO service_role;

ALTER TABLE public.memo_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memo_sheets self"
  ON public.memo_sheets FOR ALL
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE INDEX memo_sheets_student_created ON public.memo_sheets (student_id, created_at DESC);
CREATE INDEX memo_sheets_subject ON public.memo_sheets (student_id, subject);

CREATE TRIGGER memo_sheets_set_updated_at
  BEFORE UPDATE ON public.memo_sheets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Progression par bloc
CREATE TABLE public.memo_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sheet_id UUID NOT NULL REFERENCES public.memo_sheets(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_index INT NOT NULL,
  mastered_at TIMESTAMPTZ,
  quiz_score NUMERIC,
  attempts INT NOT NULL DEFAULT 0,
  next_review_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sheet_id, block_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memo_progress TO authenticated;
GRANT ALL ON public.memo_progress TO service_role;

ALTER TABLE public.memo_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memo_progress self"
  ON public.memo_progress FOR ALL
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE INDEX memo_progress_sheet ON public.memo_progress (sheet_id);
CREATE INDEX memo_progress_review ON public.memo_progress (student_id, next_review_at);

CREATE TRIGGER memo_progress_set_updated_at
  BEFORE UPDATE ON public.memo_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
