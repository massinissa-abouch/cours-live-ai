CREATE OR REPLACE FUNCTION public.join_group_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _gid uuid;
  _cnt int;
  _max int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié' USING ERRCODE = '42501';
  END IF;
  IF _code IS NULL OR length(trim(_code)) < 4 THEN
    RAISE EXCEPTION 'Code invalide';
  END IF;

  SELECT id, max_members INTO _gid, _max
  FROM public.study_groups
  WHERE invite_code = upper(trim(_code));

  IF _gid IS NULL THEN
    RAISE EXCEPTION 'Code invalide';
  END IF;

  SELECT count(*) INTO _cnt FROM public.group_members WHERE group_id = _gid;
  IF _cnt >= _max THEN
    RAISE EXCEPTION 'Ce groupe est complet.';
  END IF;

  INSERT INTO public.group_members(group_id, user_id, role)
  VALUES (_gid, _uid, 'member')
  ON CONFLICT DO NOTHING;

  RETURN _gid;
END; $$;

REVOKE ALL ON FUNCTION public.join_group_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated;