-- B4: force auth.uid() inside ping_streak / redeem_referral_code
CREATE OR REPLACE FUNCTION public.ping_streak(_user uuid)
 RETURNS TABLE(streak_days integer, last_practice_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _last date;
  _streak int;
  _today date := (now() AT TIME ZONE 'UTC')::date;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié' USING ERRCODE = '42501';
  END IF;
  -- Ignore the _user argument: always operate on the caller
  SELECT g.last_practice_date INTO _last FROM public.gamification g WHERE g.student_id = _uid;
  SELECT sp.streak_days INTO _streak FROM public.student_profiles sp WHERE sp.user_id = _uid;
  IF _last = _today THEN
    NULL;
  ELSIF _last = _today - 1 THEN
    _streak := COALESCE(_streak, 0) + 1;
  ELSE
    _streak := 1;
  END IF;
  INSERT INTO public.gamification (student_id, last_practice_date)
    VALUES (_uid, _today)
    ON CONFLICT (student_id) DO UPDATE SET last_practice_date = EXCLUDED.last_practice_date, updated_at = now();
  UPDATE public.student_profiles SET streak_days = _streak, updated_at = now() WHERE user_id = _uid;
  RETURN QUERY SELECT _streak, _today;
END; $function$;

CREATE OR REPLACE FUNCTION public.redeem_referral_code(_code text, _new_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _referrer uuid;
  _count int;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié' USING ERRCODE = '42501';
  END IF;
  -- Ignore _new_user argument: always operate on the caller
  IF _code IS NULL OR length(_code) < 4 THEN RETURN; END IF;
  SELECT user_id INTO _referrer FROM public.student_profiles WHERE referral_code = _code;
  IF _referrer IS NULL OR _referrer = _uid THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.referrals WHERE referred_id = _uid) THEN RETURN; END IF;
  INSERT INTO public.referrals (referrer_id, referred_id, status) VALUES (_referrer, _uid, 'accepted');
  SELECT COUNT(*) INTO _count FROM public.referrals WHERE referrer_id = _referrer AND status='accepted';
  IF _count >= 3 THEN
    UPDATE public.student_profiles
      SET perk_unlocked_until = GREATEST(COALESCE(perk_unlocked_until, now()), now()) + interval '7 days'
      WHERE user_id = _referrer;
    UPDATE public.referrals SET status='rewarded' WHERE referrer_id=_referrer AND status='accepted';
  END IF;
END; $function$;

-- Lock down execution to authenticated only
REVOKE ALL ON FUNCTION public.ping_streak(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ping_streak(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.redeem_referral_code(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_referral_code(text, uuid) TO authenticated;