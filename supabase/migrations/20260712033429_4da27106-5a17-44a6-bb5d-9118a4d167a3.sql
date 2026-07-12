
CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id uuid,
  model text NOT NULL,
  mode text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_eur numeric(12,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_usage_admin_read ON public.ai_usage FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY ai_usage_self_insert ON public.ai_usage FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
CREATE INDEX ai_usage_created_idx ON public.ai_usage(created_at DESC);
CREATE INDEX ai_usage_model_idx ON public.ai_usage(model);
