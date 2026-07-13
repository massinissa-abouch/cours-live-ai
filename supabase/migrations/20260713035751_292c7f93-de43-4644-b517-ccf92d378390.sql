
DO $$ BEGIN
  CREATE TYPE public.group_member_role AS ENUM ('owner','member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE public.study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  subject text NOT NULL,
  level text NOT NULL,
  description text,
  invite_code text NOT NULL UNIQUE,
  max_members int NOT NULL DEFAULT 20 CHECK (max_members BETWEEN 2 AND 50),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_groups TO authenticated;
GRANT ALL ON public.study_groups TO service_role;
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.group_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
CREATE INDEX ON public.group_members(user_id);
CREATE INDEX ON public.group_members(group_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.group_members WHERE group_id=_group AND user_id=_user);
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.study_groups WHERE id=_group AND owner_id=_user);
$$;

CREATE TABLE public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.group_messages(group_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.group_resources(group_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_resources TO authenticated;
GRANT ALL ON public.group_resources TO service_role;
ALTER TABLE public.group_resources ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.group_events(group_id, event_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_events TO authenticated;
GRANT ALL ON public.group_events TO service_role;
ALTER TABLE public.group_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_exam_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  exam_date date NOT NULL,
  chapters text[] NOT NULL DEFAULT '{}',
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  quiz jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.group_exam_alerts(group_id, exam_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_exam_alerts TO authenticated;
GRANT ALL ON public.group_exam_alerts TO service_role;
ALTER TABLE public.group_exam_alerts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_pomodoro_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  started_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('focus','break','idle')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.group_pomodoro_sessions(group_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_pomodoro_sessions TO authenticated;
GRANT ALL ON public.group_pomodoro_sessions TO service_role;
ALTER TABLE public.group_pomodoro_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see their groups" ON public.study_groups
  FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "Anyone auth can create a group" ON public.study_groups
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner updates group" ON public.study_groups
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner deletes group" ON public.study_groups
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Members see coworkers" ON public.group_members
  FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "User joins as self" ON public.group_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "User leaves self or owner removes" ON public.group_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_owner(group_id, auth.uid()));

CREATE POLICY "Members read messages" ON public.group_messages
  FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Members send messages" ON public.group_messages
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Author deletes own message" ON public.group_messages
  FOR DELETE TO authenticated USING (author_id = auth.uid());

CREATE POLICY "Members read resources" ON public.group_resources
  FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Members add resources" ON public.group_resources
  FOR INSERT TO authenticated
  WITH CHECK (uploader_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Uploader or owner deletes" ON public.group_resources
  FOR DELETE TO authenticated
  USING (uploader_id = auth.uid() OR public.is_group_owner(group_id, auth.uid()));

CREATE POLICY "Members read events" ON public.group_events
  FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Members create events" ON public.group_events
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Creator or owner deletes event" ON public.group_events
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_group_owner(group_id, auth.uid()));

CREATE POLICY "Members read alerts" ON public.group_exam_alerts
  FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Members create alerts" ON public.group_exam_alerts
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Creator or owner deletes alert" ON public.group_exam_alerts
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_group_owner(group_id, auth.uid()));

CREATE POLICY "Members read pomodoro" ON public.group_pomodoro_sessions
  FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Members start pomodoro" ON public.group_pomodoro_sessions
  FOR INSERT TO authenticated
  WITH CHECK (started_by = auth.uid() AND public.is_group_member(group_id, auth.uid()));

CREATE TRIGGER trg_study_groups_updated
  BEFORE UPDATE ON public.study_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.study_group_add_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members(group_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_study_group_owner
  AFTER INSERT ON public.study_groups
  FOR EACH ROW EXECUTE FUNCTION public.study_group_add_owner();

CREATE OR REPLACE FUNCTION public.generate_group_invite_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    LOOP
      NEW.invite_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      EXIT WHEN NOT EXISTS(SELECT 1 FROM public.study_groups WHERE invite_code = NEW.invite_code);
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_group_invite_code
  BEFORE INSERT ON public.study_groups
  FOR EACH ROW EXECUTE FUNCTION public.generate_group_invite_code();

CREATE OR REPLACE FUNCTION public.enforce_group_max_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cnt int; _max int;
BEGIN
  SELECT max_members INTO _max FROM public.study_groups WHERE id = NEW.group_id;
  SELECT count(*) INTO _cnt FROM public.group_members WHERE group_id = NEW.group_id;
  IF _cnt >= _max THEN
    RAISE EXCEPTION 'Ce groupe est complet.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_group_max_members
  BEFORE INSERT ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_max_members();

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_pomodoro_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
