
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('student','teacher','parent','admin');
CREATE TYPE public.school_level AS ENUM (
  'primaire','cem_1','cem_2','cem_3','cem_4',
  'lycee_1_tc','lycee_2_sciences','lycee_2_lettres','lycee_2_maths','lycee_2_gestion','lycee_2_langues','lycee_2_techmath',
  'lycee_3_sciences','lycee_3_lettres','lycee_3_maths','lycee_3_gestion','lycee_3_langues','lycee_3_techmath',
  'univ_1','univ_2','univ_3','autre'
);
CREATE TYPE public.exam_target AS ENUM ('none','bem','bac');
CREATE TYPE public.language_code AS ENUM ('fr','ar');
CREATE TYPE public.verification_status AS ENUM ('pending','verified','rejected');
CREATE TYPE public.course_status AS ENUM ('draft','published','archived');
CREATE TYPE public.price_type AS ENUM ('series','per_session');
CREATE TYPE public.session_type AS ENUM ('solo','group');
CREATE TYPE public.session_status AS ENUM ('scheduled','live','completed','cancelled');
CREATE TYPE public.booking_status AS ENUM ('booked','attended','no_show','cancelled');
CREATE TYPE public.payment_status AS ENUM ('pending','paid','failed','refunded');
CREATE TYPE public.item_type AS ENUM ('course','session');
CREATE TYPE public.earning_status AS ENUM ('pending','released','refunded');
CREATE TYPE public.report_status AS ENUM ('open','reviewed','resolved');
CREATE TYPE public.ai_source_type AS ENUM ('generated','from_photo','from_text');
CREATE TYPE public.link_status AS ENUM ('pending','accepted','rejected');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, avatar_url TEXT, phone TEXT,
  language public.language_code NOT NULL DEFAULT 'fr',
  wilaya TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY p1 ON public.profiles FOR SELECT USING (true);
CREATE POLICY p2 ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY p3 ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY ur1 ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role);
$$;

-- TEACHER PROFILES
CREATE TABLE public.teacher_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bio TEXT,
  subjects TEXT[] NOT NULL DEFAULT '{}',
  levels public.school_level[] NOT NULL DEFAULT '{}',
  hourly_rate NUMERIC(10,2),
  id_document_url TEXT, diploma_url TEXT,
  verification_status public.verification_status NOT NULL DEFAULT 'pending',
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_students INT NOT NULL DEFAULT 0,
  allow_recording BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teacher_profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.teacher_profiles TO authenticated;
GRANT ALL ON public.teacher_profiles TO service_role;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tp1 ON public.teacher_profiles FOR SELECT USING (true);
CREATE POLICY tp2 ON public.teacher_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY tp3 ON public.teacher_profiles FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_teacher_updated BEFORE UPDATE ON public.teacher_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- STUDENT PROFILES
CREATE TABLE public.student_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_level public.school_level,
  exam_target public.exam_target NOT NULL DEFAULT 'none',
  streak_days INT NOT NULL DEFAULT 0,
  credits NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.student_profiles TO authenticated;
GRANT ALL ON public.student_profiles TO service_role;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY sp1 ON public.student_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_student_updated BEFORE UPDATE ON public.student_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PARENT-CHILD
CREATE TABLE public.parent_child_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.link_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_child_links TO authenticated;
GRANT ALL ON public.parent_child_links TO service_role;
ALTER TABLE public.parent_child_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY pcl1 ON public.parent_child_links FOR SELECT USING (auth.uid() IN (parent_id, student_id));
CREATE POLICY pcl2 ON public.parent_child_links FOR INSERT WITH CHECK (auth.uid() = parent_id);
CREATE POLICY pcl3 ON public.parent_child_links FOR UPDATE USING (auth.uid() = student_id);

CREATE OR REPLACE FUNCTION public.is_parent_of(_parent UUID, _student UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.parent_child_links WHERE parent_id=_parent AND student_id=_student AND status='accepted');
$$;

-- COURSES
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT,
  subject TEXT NOT NULL,
  level public.school_level NOT NULL,
  language public.language_code NOT NULL DEFAULT 'fr',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_type public.price_type NOT NULL DEFAULT 'series',
  trailer_video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  enrolled_count INT NOT NULL DEFAULT 0,
  status public.course_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY c1 ON public.courses FOR SELECT USING (status='published' OR auth.uid() = teacher_id);
CREATE POLICY c2 ON public.courses FOR ALL USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ENROLLMENTS (before videos)
CREATE TABLE public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id UUID,
  progress_pct INT NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, student_id)
);
GRANT SELECT, INSERT, UPDATE ON public.course_enrollments TO authenticated;
GRANT ALL ON public.course_enrollments TO service_role;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ce1 ON public.course_enrollments FOR SELECT USING (
  auth.uid() = student_id
  OR EXISTS(SELECT 1 FROM public.courses c WHERE c.id=course_id AND c.teacher_id=auth.uid())
  OR public.is_parent_of(auth.uid(), student_id)
);
CREATE POLICY ce2 ON public.course_enrollments FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY ce3 ON public.course_enrollments FOR UPDATE USING (auth.uid() = student_id);

-- COURSE VIDEOS
CREATE TABLE public.course_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL, video_url TEXT NOT NULL,
  duration_sec INT, order_index INT NOT NULL DEFAULT 0,
  is_free_preview BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.course_videos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_videos TO authenticated;
GRANT ALL ON public.course_videos TO service_role;
ALTER TABLE public.course_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY cv1 ON public.course_videos FOR SELECT USING (
  is_free_preview = true
  OR EXISTS(SELECT 1 FROM public.courses c WHERE c.id=course_id AND c.teacher_id=auth.uid())
  OR EXISTS(SELECT 1 FROM public.course_enrollments e WHERE e.course_id=course_videos.course_id AND e.student_id=auth.uid())
);
CREATE POLICY cv2 ON public.course_videos FOR ALL USING (
  EXISTS(SELECT 1 FROM public.courses c WHERE c.id=course_id AND c.teacher_id=auth.uid())
) WITH CHECK (
  EXISTS(SELECT 1 FROM public.courses c WHERE c.id=course_id AND c.teacher_id=auth.uid())
);

-- COURSE REVIEWS
CREATE TABLE public.course_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, student_id)
);
GRANT SELECT ON public.course_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_reviews TO authenticated;
GRANT ALL ON public.course_reviews TO service_role;
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY cr1 ON public.course_reviews FOR SELECT USING (true);
CREATE POLICY cr2 ON public.course_reviews FOR INSERT WITH CHECK (
  auth.uid() = student_id AND EXISTS(SELECT 1 FROM public.course_enrollments e WHERE e.course_id=course_reviews.course_id AND e.student_id=auth.uid())
);
CREATE POLICY cr3 ON public.course_reviews FOR UPDATE USING (auth.uid() = student_id);
CREATE POLICY cr4 ON public.course_reviews FOR DELETE USING (auth.uid() = student_id);

-- AVAILABILITY
CREATE TABLE public.teacher_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL,
  start_time TIME NOT NULL, end_time TIME NOT NULL,
  recurring BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teacher_availability TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_availability TO authenticated;
GRANT ALL ON public.teacher_availability TO service_role;
ALTER TABLE public.teacher_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY ta1 ON public.teacher_availability FOR SELECT USING (true);
CREATE POLICY ta2 ON public.teacher_availability FOR ALL USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

-- LIVE SESSIONS
CREATE TABLE public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT, subject TEXT NOT NULL, level public.school_level NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min INT NOT NULL DEFAULT 60,
  session_type public.session_type NOT NULL DEFAULT 'solo',
  max_students INT NOT NULL DEFAULT 1 CHECK (max_students BETWEEN 1 AND 5),
  price_per_student NUMERIC(10,2) NOT NULL,
  daily_room_url TEXT, recording_url TEXT,
  status public.session_status NOT NULL DEFAULT 'scheduled',
  allow_recording BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.live_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_sessions TO authenticated;
GRANT ALL ON public.live_sessions TO service_role;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ls1 ON public.live_sessions FOR SELECT USING (true);
CREATE POLICY ls2 ON public.live_sessions FOR ALL USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON public.live_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BOOKINGS
CREATE TABLE public.session_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id UUID,
  status public.booking_status NOT NULL DEFAULT 'booked',
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);
GRANT SELECT, INSERT, UPDATE ON public.session_bookings TO authenticated;
GRANT ALL ON public.session_bookings TO service_role;
ALTER TABLE public.session_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY sb1 ON public.session_bookings FOR SELECT USING (
  auth.uid() = student_id
  OR EXISTS(SELECT 1 FROM public.live_sessions s WHERE s.id=session_id AND s.teacher_id=auth.uid())
  OR public.is_parent_of(auth.uid(), student_id)
);
CREATE POLICY sb2 ON public.session_bookings FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY sb3 ON public.session_bookings FOR UPDATE USING (auth.uid() = student_id);

-- SESSION QUIZZES
CREATE TABLE public.session_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  question TEXT NOT NULL, options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_quizzes TO authenticated;
GRANT ALL ON public.session_quizzes TO service_role;
ALTER TABLE public.session_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY sq1 ON public.session_quizzes FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.live_sessions s WHERE s.id=session_id AND s.teacher_id=auth.uid())
  OR EXISTS(SELECT 1 FROM public.session_bookings b WHERE b.session_id=session_quizzes.session_id AND b.student_id=auth.uid())
);
CREATE POLICY sq2 ON public.session_quizzes FOR ALL USING (
  EXISTS(SELECT 1 FROM public.live_sessions s WHERE s.id=session_id AND s.teacher_id=auth.uid())
) WITH CHECK (
  EXISTS(SELECT 1 FROM public.live_sessions s WHERE s.id=session_id AND s.teacher_id=auth.uid())
);

-- QUIZ RESPONSES
CREATE TABLE public.quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.session_quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, student_id)
);
GRANT SELECT, INSERT ON public.quiz_responses TO authenticated;
GRANT ALL ON public.quiz_responses TO service_role;
ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY qr1 ON public.quiz_responses FOR SELECT USING (
  auth.uid() = student_id
  OR EXISTS(SELECT 1 FROM public.session_quizzes q JOIN public.live_sessions s ON s.id=q.session_id WHERE q.id=quiz_id AND s.teacher_id=auth.uid())
);
CREATE POLICY qr2 ON public.quiz_responses FOR INSERT WITH CHECK (auth.uid() = student_id);

-- WAITLIST
CREATE TABLE public.session_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT, preferred_slots JSONB,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.session_waitlist TO authenticated;
GRANT ALL ON public.session_waitlist TO service_role;
ALTER TABLE public.session_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY sw1 ON public.session_waitlist FOR SELECT USING (auth.uid() IN (student_id, teacher_id));
CREATE POLICY sw2 ON public.session_waitlist FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY sw3 ON public.session_waitlist FOR DELETE USING (auth.uid() = student_id);

-- SESSION REVIEWS
CREATE TABLE public.session_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL, comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);
GRANT SELECT ON public.session_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_reviews TO authenticated;
GRANT ALL ON public.session_reviews TO service_role;
ALTER TABLE public.session_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY sr1 ON public.session_reviews FOR SELECT USING (true);
CREATE POLICY sr2 ON public.session_reviews FOR INSERT WITH CHECK (
  auth.uid() = student_id AND EXISTS(SELECT 1 FROM public.session_bookings b WHERE b.session_id=session_reviews.session_id AND b.student_id=auth.uid())
);
CREATE POLICY sr3 ON public.session_reviews FOR UPDATE USING (auth.uid() = student_id);

-- REPORTS
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  reason TEXT NOT NULL, description TEXT,
  status public.report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp1 ON public.reports FOR SELECT USING (auth.uid() = reporter_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY rp2 ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY rp3 ON public.reports FOR UPDATE USING (public.has_role(auth.uid(),'admin'));

-- AI EXERCISES
CREATE TABLE public.ai_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL, level public.school_level NOT NULL,
  source_type public.ai_source_type NOT NULL DEFAULT 'generated',
  source_content TEXT,
  generated_exercise JSONB NOT NULL,
  difficulty INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_exercises TO authenticated;
GRANT ALL ON public.ai_exercises TO service_role;
ALTER TABLE public.ai_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY aex1 ON public.ai_exercises FOR SELECT USING (auth.uid() = student_id OR public.is_parent_of(auth.uid(), student_id));
CREATE POLICY aex2 ON public.ai_exercises FOR INSERT WITH CHECK (auth.uid() = student_id);

-- AI SUBMISSIONS
CREATE TABLE public.ai_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES public.ai_exercises(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_answer TEXT NOT NULL,
  ai_feedback TEXT, is_correct BOOLEAN,
  score NUMERIC(5,2),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_submissions TO authenticated;
GRANT ALL ON public.ai_submissions TO service_role;
ALTER TABLE public.ai_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY asub1 ON public.ai_submissions FOR SELECT USING (auth.uid() = student_id OR public.is_parent_of(auth.uid(), student_id));
CREATE POLICY asub2 ON public.ai_submissions FOR INSERT WITH CHECK (auth.uid() = student_id);

-- AI QUIZZES
CREATE TABLE public.ai_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL, chapter TEXT,
  level public.school_level NOT NULL,
  questions JSONB NOT NULL,
  score NUMERIC(5,2), completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_quizzes TO authenticated;
GRANT ALL ON public.ai_quizzes TO service_role;
ALTER TABLE public.ai_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY aq1 ON public.ai_quizzes FOR ALL USING (auth.uid() = student_id OR public.is_parent_of(auth.uid(), student_id)) WITH CHECK (auth.uid() = student_id);

-- GAMIFICATION
CREATE TABLE public.gamification (
  student_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  badges JSONB NOT NULL DEFAULT '[]',
  chapters_completed JSONB NOT NULL DEFAULT '[]',
  last_practice_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.gamification TO authenticated;
GRANT ALL ON public.gamification TO service_role;
ALTER TABLE public.gamification ENABLE ROW LEVEL SECURITY;
CREATE POLICY g1 ON public.gamification FOR ALL USING (auth.uid() = student_id OR public.is_parent_of(auth.uid(), student_id)) WITH CHECK (auth.uid() = student_id);
CREATE TRIGGER trg_gamif_updated BEFORE UPDATE ON public.gamification FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'DZD',
  chargily_checkout_id TEXT, chargily_payment_url TEXT,
  status public.payment_status NOT NULL DEFAULT 'pending',
  item_type public.item_type NOT NULL,
  item_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY pay1 ON public.payments FOR SELECT USING (auth.uid() = user_id OR public.is_parent_of(auth.uid(), user_id));
CREATE POLICY pay2 ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- EARNINGS
CREATE TABLE public.teacher_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(10,2) NOT NULL,
  status public.earning_status NOT NULL DEFAULT 'pending',
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teacher_earnings TO authenticated;
GRANT ALL ON public.teacher_earnings TO service_role;
ALTER TABLE public.teacher_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY te1 ON public.teacher_earnings FOR SELECT USING (auth.uid() = teacher_id);

-- PAYOUTS
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  method TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);
GRANT SELECT, INSERT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY po1 ON public.payouts FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY po2 ON public.payouts FOR INSERT WITH CHECK (auth.uid() = teacher_id);

-- REFERRALS
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);
GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY ref1 ON public.referrals FOR SELECT USING (auth.uid() IN (referrer_id, referred_id));
CREATE POLICY ref2 ON public.referrals FOR INSERT WITH CHECK (auth.uid() IN (referrer_id, referred_id));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, title TEXT NOT NULL,
  body TEXT, link TEXT, read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY n1 ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY n2 ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- EXAM COUNTDOWNS
CREATE TABLE public.exam_countdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam public.exam_target NOT NULL,
  exam_date DATE NOT NULL,
  year INT NOT NULL,
  UNIQUE(exam, year)
);
GRANT SELECT ON public.exam_countdowns TO anon;
GRANT SELECT ON public.exam_countdowns TO authenticated;
GRANT ALL ON public.exam_countdowns TO service_role;
ALTER TABLE public.exam_countdowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY ec1 ON public.exam_countdowns FOR SELECT USING (true);

-- AUTO PROFILE + STUDENT ROLE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.student_profiles (user_id) VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.gamification (student_id) VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
