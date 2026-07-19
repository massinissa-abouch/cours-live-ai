CREATE OR REPLACE FUNCTION public.enforce_session_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cnt int;
  _max int;
BEGIN
  -- Only enforce when the row is active
  IF NEW.status NOT IN ('booked', 'attended') THEN
    RETURN NEW;
  END IF;

  SELECT max_students INTO _max
  FROM public.live_sessions WHERE id = NEW.session_id;
  IF _max IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO _cnt
  FROM public.session_bookings
  WHERE session_id = NEW.session_id
    AND status IN ('booked', 'attended')
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF _cnt >= _max THEN
    RAISE EXCEPTION 'La session est complète.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_session_capacity ON public.session_bookings;
CREATE TRIGGER trg_enforce_session_capacity
  BEFORE INSERT OR UPDATE ON public.session_bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_session_capacity();