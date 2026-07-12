import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const BUDGET_EUR = 100;
export const ALERT_EUR = 80;

export const getAiCostSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Admin gate
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    const { data: rows, error } = await context.supabase
      .from("ai_usage")
      .select("model,mode,input_tokens,output_tokens,cost_eur,created_at")
      .gte("created_at", startOfMonth)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;

    const list = rows ?? [];
    const monthTotal = list.reduce((s, r) => s + Number(r.cost_eur ?? 0), 0);
    const byModel: Record<string, { cost: number; requests: number; inTokens: number; outTokens: number }> = {};
    const byDay: Record<string, number> = {};
    for (const r of list) {
      const m = r.model ?? "unknown";
      byModel[m] ??= { cost: 0, requests: 0, inTokens: 0, outTokens: 0 };
      byModel[m].cost += Number(r.cost_eur ?? 0);
      byModel[m].requests += 1;
      byModel[m].inTokens += r.input_tokens ?? 0;
      byModel[m].outTokens += r.output_tokens ?? 0;
      const day = (r.created_at ?? "").slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + Number(r.cost_eur ?? 0);
    }

    return {
      monthTotal,
      requests: list.length,
      byModel,
      byDay,
      budget: BUDGET_EUR,
      alertThreshold: ALERT_EUR,
      overAlert: monthTotal >= ALERT_EUR,
      overBudget: monthTotal >= BUDGET_EUR,
      periodStart: startOfMonth,
    };
  });