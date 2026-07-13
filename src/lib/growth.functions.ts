import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const pingStreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("ping_streak", { _user: context.userId });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      streakDays: (row?.streak_days as number | null) ?? 0,
      lastPracticeDate: (row?.last_practice_date as string | null) ?? null,
    };
  });

export const getGrowthStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: sp }, { data: refs }] = await Promise.all([
      context.supabase
        .from("student_profiles")
        .select("streak_days, referral_code, perk_unlocked_until")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("referrals")
        .select("id, status, created_at")
        .eq("referrer_id", context.userId)
        .order("created_at", { ascending: false }),
    ]);

    const referrals = refs ?? [];
    const accepted = referrals.filter((r) => r.status === "accepted").length;
    const rewarded = referrals.filter((r) => r.status === "rewarded").length;
    const perkUntil = sp?.perk_unlocked_until ? new Date(sp.perk_unlocked_until) : null;
    const perkActive = !!perkUntil && perkUntil.getTime() > Date.now();
    return {
      streakDays: sp?.streak_days ?? 0,
      referralCode: sp?.referral_code ?? null,
      acceptedCount: accepted,
      rewardedCount: rewarded,
      totalReferred: accepted + rewarded,
      perkUnlockedUntil: sp?.perk_unlocked_until ?? null,
      perkActive,
    };
  });

export const redeemReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(4).max(32) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("redeem_referral_code", {
      _code: data.code.trim().toLowerCase(),
      _new_user: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });