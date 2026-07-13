-- Archive Bac & BEM
CREATE TABLE public.exam_archive (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type public.exam_target NOT NULL CHECK (exam_type IN ('bem','bac')),
  year INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  subject TEXT NOT NULL,
  filiere TEXT,
  title TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  correction_url TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.exam_archive TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.exam_archive TO authenticated;
GRANT ALL ON public.exam_archive TO service_role;

ALTER TABLE public.exam_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_archive public read"
  ON public.exam_archive FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "exam_archive admin insert"
  ON public.exam_archive FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "exam_archive admin update"
  ON public.exam_archive FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "exam_archive admin delete"
  ON public.exam_archive FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX exam_archive_filter_idx ON public.exam_archive (exam_type, year DESC, subject);

CREATE TRIGGER exam_archive_set_updated_at
  BEFORE UPDATE ON public.exam_archive
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();