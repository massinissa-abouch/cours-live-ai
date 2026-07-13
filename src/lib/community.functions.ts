import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Ad-hoc rate limits (no dedicated primitive on the backend):
// - 5 threads / hour / user
// - 20 posts / hour / user
const THREAD_LIMIT_PER_HOUR = 5;
const POST_LIMIT_PER_HOUR = 20;

async function assertNotBanned(supabase: any, userId: string) {
  const { data } = await supabase
    .from("community_bans")
    .select("banned_until, reason")
    .eq("user_id", userId)
    .maybeSingle();
  if (data && new Date(data.banned_until).getTime() > Date.now()) {
    throw new Error(`Tu es banni jusqu'au ${new Date(data.banned_until).toLocaleDateString("fr-FR")}${data.reason ? ` (${data.reason})` : ""}.`);
  }
}

async function assertRate(supabase: any, table: "community_threads" | "community_posts", userId: string, limit: number) {
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("author_id", userId)
    .gte("created_at", since);
  if ((count ?? 0) >= limit) {
    throw new Error(`Limite atteinte : ${limit} contributions par heure. Réessaie plus tard.`);
  }
}

// -------- LISTING --------

export const listThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      subject: z.string().optional(),
      level: z.string().optional(),
      sort: z.enum(["recent", "popular"]).default("recent"),
      limit: z.number().int().min(1).max(50).default(30),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("community_threads")
      .select("id,title,subject,level,author_id,posts_count,last_post_at,created_at,hidden")
      .eq("hidden", false);
    if (data.subject) q = q.eq("subject", data.subject);
    if (data.level) q = q.eq("level", data.level);
    q = data.sort === "popular"
      ? q.order("posts_count", { ascending: false }).order("last_post_at", { ascending: false })
      : q.order("last_post_at", { ascending: false });
    const { data: threads } = await q.limit(data.limit);
    const authorIds = Array.from(new Set((threads ?? []).map((t) => t.author_id)));
    const { data: profiles } = authorIds.length
      ? await context.supabase.from("profiles").select("id, full_name").in("id", authorIds)
      : { data: [] };
    return { threads: threads ?? [], profiles: profiles ?? [] };
  });

export const getThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: thread } = await context.supabase
      .from("community_threads").select("*").eq("id", data.id).maybeSingle();
    if (!thread) throw new Error("Fil introuvable");
    const { data: posts } = await context.supabase
      .from("community_posts")
      .select("id,thread_id,author_id,body,likes_count,hidden,created_at")
      .eq("thread_id", data.id)
      .eq("hidden", false)
      .order("created_at", { ascending: true });
    const userIds = Array.from(new Set([thread.author_id, ...(posts ?? []).map((p) => p.author_id)]));
    const [{ data: profiles }, { data: myLikes }] = await Promise.all([
      context.supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds),
      context.supabase.from("community_post_likes").select("post_id").eq("user_id", context.userId),
    ]);
    return {
      thread,
      posts: posts ?? [],
      profiles: profiles ?? [],
      likedPostIds: (myLikes ?? []).map((l) => l.post_id),
    };
  });

// -------- MUTATIONS --------

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      title: z.string().trim().min(3).max(140),
      body: z.string().trim().min(1).max(4000),
      subject: z.string().trim().min(1).max(60),
      level: z.string().trim().min(1).max(40),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertNotBanned(context.supabase, context.userId);
    await assertRate(context.supabase, "community_threads", context.userId, THREAD_LIMIT_PER_HOUR);
    const { data: row, error } = await context.supabase
      .from("community_threads")
      .insert({ ...data, author_id: context.userId })
      .select("id")
      .single();
    if (error) throw error;
    return row;
  });

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      threadId: z.string().uuid(),
      body: z.string().trim().min(1).max(4000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertNotBanned(context.supabase, context.userId);
    await assertRate(context.supabase, "community_posts", context.userId, POST_LIMIT_PER_HOUR);
    const { data: row, error } = await context.supabase
      .from("community_posts")
      .insert({ thread_id: data.threadId, author_id: context.userId, body: data.body })
      .select("id,thread_id,author_id,body,likes_count,hidden,created_at")
      .single();
    if (error) throw error;
    return row;
  });

export const togglePostLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ postId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("community_post_likes")
      .select("post_id")
      .eq("post_id", data.postId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      await context.supabase.from("community_post_likes").delete()
        .eq("post_id", data.postId).eq("user_id", context.userId);
      return { liked: false };
    }
    await context.supabase.from("community_post_likes")
      .insert({ post_id: data.postId, user_id: context.userId });
    return { liked: true };
  });

export const reportContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      targetType: z.enum(["thread", "post"]),
      targetId: z.string().uuid(),
      reason: z.string().trim().min(3).max(500),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("post_reports")
      .insert({
        reporter_id: context.userId,
        target_type: data.targetType,
        target_id: data.targetId,
        reason: data.reason,
      });
    if (error) throw error;
    return { ok: true };
  });

export const deleteOwnThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase.from("community_threads").delete().eq("id", data.id);
    return { ok: true };
  });

export const deleteOwnPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase.from("community_posts").delete().eq("id", data.id);
    return { ok: true };
  });

// -------- ADMIN --------

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Réservé aux administrateurs");
}

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: reports } = await context.supabase
      .from("post_reports")
      .select("*")
      .order("status", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);
    return reports ?? [];
  });

export const resolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["hide", "dismiss", "delete"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: report } = await context.supabase
      .from("post_reports").select("*").eq("id", data.id).maybeSingle();
    if (!report) throw new Error("Signalement introuvable");

    if (data.action === "hide") {
      const table = report.target_type === "thread" ? "community_threads" : "community_posts";
      await context.supabase.from(table).update({ hidden: true }).eq("id", report.target_id);
    } else if (data.action === "delete") {
      const table = report.target_type === "thread" ? "community_threads" : "community_posts";
      await context.supabase.from(table).delete().eq("id", report.target_id);
    }
    await context.supabase
      .from("post_reports")
      .update({
        status: data.action === "dismiss" ? "dismissed" : "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return { ok: true };
  });

export const banUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      userId: z.string().uuid(),
      days: z.number().int().min(1).max(365),
      reason: z.string().trim().max(200).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const until = new Date(Date.now() + data.days * 86400_000).toISOString();
    const { error } = await context.supabase
      .from("community_bans")
      .upsert({ user_id: data.userId, banned_until: until, reason: data.reason ?? null });
    if (error) throw error;
    return { ok: true, until };
  });