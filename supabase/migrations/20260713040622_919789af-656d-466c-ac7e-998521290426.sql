
CREATE TABLE public.community_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 140),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  subject text NOT NULL,
  level text NOT NULL,
  posts_count int NOT NULL DEFAULT 0,
  last_post_at timestamptz NOT NULL DEFAULT now(),
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.community_threads(subject, level, last_post_at DESC);
CREATE INDEX ON public.community_threads(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_threads TO authenticated;
GRANT ALL ON public.community_threads TO service_role;
ALTER TABLE public.community_threads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.community_threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  likes_count int NOT NULL DEFAULT 0,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.community_posts(thread_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.community_post_likes (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_post_likes TO authenticated;
GRANT ALL ON public.community_post_likes TO service_role;
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('thread','post')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX ON public.post_reports(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_reports TO authenticated;
GRANT ALL ON public.post_reports TO service_role;
ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.community_bans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_until timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_bans TO authenticated;
GRANT ALL ON public.community_bans TO service_role;
ALTER TABLE public.community_bans ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_community_banned(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.community_bans WHERE user_id=_user AND banned_until > now());
$$;

-- THREADS policies
CREATE POLICY "Anyone auth reads threads" ON public.community_threads
  FOR SELECT TO authenticated USING (NOT hidden OR public.has_role(auth.uid(),'admin') OR author_id = auth.uid());
CREATE POLICY "Auth creates threads" ON public.community_threads
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND NOT public.is_community_banned(auth.uid()));
CREATE POLICY "Author or admin updates thread" ON public.community_threads
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Author or admin deletes thread" ON public.community_threads
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- POSTS policies
CREATE POLICY "Anyone auth reads posts" ON public.community_posts
  FOR SELECT TO authenticated USING (NOT hidden OR public.has_role(auth.uid(),'admin') OR author_id = auth.uid());
CREATE POLICY "Auth creates posts" ON public.community_posts
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND NOT public.is_community_banned(auth.uid()));
CREATE POLICY "Author or admin updates post" ON public.community_posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Author or admin deletes post" ON public.community_posts
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- LIKES policies
CREATE POLICY "Auth reads likes" ON public.community_post_likes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth likes as self" ON public.community_post_likes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Auth unlikes own" ON public.community_post_likes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- REPORTS policies
CREATE POLICY "Auth creates reports" ON public.post_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Admin reads reports" ON public.post_reports
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR reporter_id = auth.uid());
CREATE POLICY "Admin updates reports" ON public.post_reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- BANS policies
CREATE POLICY "User sees own ban" ON public.community_bans
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin manages bans" ON public.community_bans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Triggers
CREATE TRIGGER trg_community_threads_updated
  BEFORE UPDATE ON public.community_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.bump_thread_on_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_threads
      SET posts_count = posts_count + 1, last_post_at = NEW.created_at
      WHERE id = NEW.thread_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_threads
      SET posts_count = GREATEST(posts_count - 1, 0)
      WHERE id = OLD.thread_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_bump_thread
  AFTER INSERT OR DELETE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.bump_thread_on_post();

CREATE OR REPLACE FUNCTION public.bump_post_likes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_bump_post_likes
  AFTER INSERT OR DELETE ON public.community_post_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_post_likes();
