
-- Referral code + perk unlock on student profiles
ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS perk_unlocked_until timestamptz;

UPDATE public.student_profiles
SET referral_code = substr(replace(gen_random_uuid()::text,'-',''),1,8)
WHERE referral_code IS NULL;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      NEW.referral_code := substr(replace(gen_random_uuid()::text,'-',''),1,8);
      EXIT WHEN NOT EXISTS(SELECT 1 FROM public.student_profiles WHERE referral_code = NEW.referral_code);
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS student_profiles_referral_code ON public.student_profiles;
CREATE TRIGGER student_profiles_referral_code
BEFORE INSERT ON public.student_profiles
FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

-- Redeem referral: called by newly registered user with a code
CREATE OR REPLACE FUNCTION public.redeem_referral_code(_code text, _new_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _referrer uuid;
  _count int;
BEGIN
  IF _code IS NULL OR length(_code) < 4 THEN RETURN; END IF;
  SELECT user_id INTO _referrer FROM public.student_profiles WHERE referral_code = _code;
  IF _referrer IS NULL OR _referrer = _new_user THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.referrals WHERE referred_id = _new_user) THEN RETURN; END IF;
  INSERT INTO public.referrals (referrer_id, referred_id, status) VALUES (_referrer, _new_user, 'accepted');
  SELECT COUNT(*) INTO _count FROM public.referrals WHERE referrer_id = _referrer AND status='accepted';
  IF _count >= 3 THEN
    UPDATE public.student_profiles
      SET perk_unlocked_until = GREATEST(COALESCE(perk_unlocked_until, now()), now()) + interval '7 days'
      WHERE user_id = _referrer;
    UPDATE public.referrals SET status='rewarded' WHERE referrer_id=_referrer AND status='accepted';
  END IF;
END; $$;

-- Ping streak (called on activity)
CREATE OR REPLACE FUNCTION public.ping_streak(_user uuid)
RETURNS TABLE(streak_days int, last_practice_date date) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _last date;
  _streak int;
  _today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  SELECT g.last_practice_date INTO _last FROM public.gamification g WHERE g.student_id = _user;
  SELECT sp.streak_days INTO _streak FROM public.student_profiles sp WHERE sp.user_id = _user;
  IF _last = _today THEN
    -- no change
    NULL;
  ELSIF _last = _today - 1 THEN
    _streak := COALESCE(_streak, 0) + 1;
  ELSE
    _streak := 1;
  END IF;
  INSERT INTO public.gamification (student_id, last_practice_date)
    VALUES (_user, _today)
    ON CONFLICT (student_id) DO UPDATE SET last_practice_date = EXCLUDED.last_practice_date, updated_at = now();
  UPDATE public.student_profiles SET streak_days = _streak, updated_at = now() WHERE user_id = _user;
  RETURN QUERY SELECT _streak, _today;
END; $$;

-- Allow authenticated users to read referrals they participate in (for progress display)
DROP POLICY IF EXISTS "referrals_view_own" ON public.referrals;
CREATE POLICY "referrals_view_own" ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
