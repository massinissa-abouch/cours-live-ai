
REVOKE ALL ON FUNCTION public.redeem_referral_code(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_referral_code(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.ping_streak(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ping_streak(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;
