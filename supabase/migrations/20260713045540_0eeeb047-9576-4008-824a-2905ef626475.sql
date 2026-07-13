-- Cahier de textes intelligent : tâches/exercices avec rappels multi-canaux
CREATE TABLE public.student_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text,
  chapter text,
  level text,
  difficulty smallint NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  estimated_minutes int NOT NULL DEFAULT 30 CHECK (estimated_minutes BETWEEN 5 AND 600),
  notes text,
  source_type text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual','photo','text','import')),
  source_content text,
  ai_analysis jsonb,
  due_at timestamptz,
  reminder_at timestamptz,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done','skipped')),
  priority_score numeric NOT NULL DEFAULT 0,
  completed_at timestamptz,
  actual_minutes int,
  self_grade smallint CHECK (self_grade BETWEEN 0 AND 20),
  group_id uuid REFERENCES public.study_groups(id) ON DELETE SET NULL,
  share_with_group boolean NOT NULL DEFAULT false,
  channels text[] NOT NULL DEFAULT ARRAY['inapp']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX student_tasks_student_due_idx ON public.student_tasks(student_id, due_at);
CREATE INDEX student_tasks_group_idx ON public.student_tasks(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX student_tasks_reminder_idx ON public.student_tasks(reminder_at) WHERE status IN ('todo','in_progress');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_tasks TO authenticated;
GRANT ALL ON public.student_tasks TO service_role;

ALTER TABLE public.student_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages tasks" ON public.student_tasks
  FOR ALL TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "group members read shared tasks" ON public.student_tasks
  FOR SELECT TO authenticated
  USING (
    share_with_group = true
    AND group_id IS NOT NULL
    AND public.is_group_member(group_id, auth.uid())
  );

CREATE TRIGGER trg_student_tasks_updated
  BEFORE UPDATE ON public.student_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Journal des rappels envoyés (dédup par tâche + palier + canal)
CREATE TABLE public.task_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.student_tasks(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  tier text NOT NULL CHECK (tier IN ('d3','d1','d0','overdue')),
  channel text NOT NULL CHECK (channel IN ('inapp','email','push','sms')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, tier, channel)
);
CREATE INDEX task_reminder_log_task_idx ON public.task_reminder_log(task_id);

GRANT SELECT, INSERT, DELETE ON public.task_reminder_log TO authenticated;
GRANT ALL ON public.task_reminder_log TO service_role;

ALTER TABLE public.task_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads own reminder log" ON public.task_reminder_log
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

-- Enregistrement device push (Web Push subscription)
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions(user_id);

GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages own subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fonction : score de priorité (urgence) recalculé à chaque update
CREATE OR REPLACE FUNCTION public.compute_task_priority()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _hours_left numeric;
  _urgency numeric := 0;
  _diff numeric;
BEGIN
  IF NEW.status IN ('done','skipped') THEN
    NEW.priority_score := 0;
    RETURN NEW;
  END IF;
  IF NEW.due_at IS NULL THEN
    NEW.priority_score := 10 + NEW.difficulty;
    RETURN NEW;
  END IF;
  _hours_left := EXTRACT(EPOCH FROM (NEW.due_at - now())) / 3600.0;
  _diff := NEW.difficulty;
  IF _hours_left <= 0 THEN
    _urgency := 100;
  ELSIF _hours_left <= 6 THEN
    _urgency := 90;
  ELSIF _hours_left <= 24 THEN
    _urgency := 75;
  ELSIF _hours_left <= 48 THEN
    _urgency := 55;
  ELSIF _hours_left <= 72 THEN
    _urgency := 35;
  ELSIF _hours_left <= 168 THEN
    _urgency := 20;
  ELSE
    _urgency := 10;
  END IF;
  NEW.priority_score := _urgency + _diff * 2 + (NEW.estimated_minutes::numeric / 30);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_student_tasks_priority
  BEFORE INSERT OR UPDATE OF due_at, difficulty, estimated_minutes, status ON public.student_tasks
  FOR EACH ROW EXECUTE FUNCTION public.compute_task_priority();

-- Realtime pour affichage instantané
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_tasks;