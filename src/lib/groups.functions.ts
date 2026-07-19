import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

// -------- Groups CRUD --------

export const listMyGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: memberships } = await context.supabase
      .from("group_members")
      .select("group_id, role, joined_at")
      .eq("user_id", context.userId);
    const ids = (memberships ?? []).map((m) => m.group_id);
    if (!ids.length) return [];
    const { data: groups } = await context.supabase
      .from("study_groups")
      .select("id,name,subject,level,description,invite_code,owner_id,max_members,created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    const { data: counts } = await context.supabase
      .from("group_members")
      .select("group_id")
      .in("group_id", ids);
    const countMap = new Map<string, number>();
    (counts ?? []).forEach((c) => countMap.set(c.group_id, (countMap.get(c.group_id) ?? 0) + 1));
    return (groups ?? []).map((g) => ({
      ...g,
      memberCount: countMap.get(g.id) ?? 0,
      role: memberships?.find((m) => m.group_id === g.id)?.role ?? "member",
    }));
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      name: z.string().trim().min(2).max(80),
      subject: z.string().trim().min(1).max(60),
      level: z.string().trim().min(1).max(40),
      description: z.string().trim().max(500).optional(),
      maxMembers: z.number().int().min(2).max(50).default(20),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("study_groups")
      .insert({
        owner_id: context.userId,
        name: data.name,
        subject: data.subject,
        level: data.level,
        description: data.description ?? null,
        max_members: data.maxMembers,
        invite_code: "",
      })
      .select("id, invite_code")
      .single();
    if (error) throw error;
    return row;
  });

export const joinGroupByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ code: z.string().trim().min(4).max(20) }).parse(i))
  .handler(async ({ data, context }) => {
    const code = data.code.toUpperCase();
    const { data: gid, error } = await (context.supabase as any)
      .rpc("join_group_by_code", { _code: code });
    if (error) throw new Error(error.message || "Code invalide");
    return { id: gid as string };
  });

export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ groupId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("group_members")
      .delete()
      .eq("group_id", data.groupId)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ groupId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("study_groups")
      .delete()
      .eq("id", data.groupId)
      .eq("owner_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// -------- Group detail (all sections) --------

export const getGroupDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ groupId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: group } = await context.supabase
      .from("study_groups")
      .select("*")
      .eq("id", data.groupId)
      .maybeSingle();
    if (!group) throw new Error("Groupe introuvable");

    const [{ data: members }, { data: messages }, { data: resources }, { data: events }, { data: alerts }, { data: pomodoro }] = await Promise.all([
      context.supabase.from("group_members").select("id,user_id,role,joined_at").eq("group_id", data.groupId),
      context.supabase.from("group_messages").select("id,author_id,body,created_at").eq("group_id", data.groupId).order("created_at", { ascending: true }).limit(200),
      context.supabase.from("group_resources").select("id,uploader_id,title,storage_path,mime_type,size_bytes,created_at").eq("group_id", data.groupId).order("created_at", { ascending: false }),
      context.supabase.from("group_events").select("id,created_by,title,description,event_at,created_at").eq("group_id", data.groupId).order("event_at", { ascending: true }),
      context.supabase.from("group_exam_alerts").select("*").eq("group_id", data.groupId).order("exam_date", { ascending: true }),
      context.supabase.from("group_pomodoro_sessions").select("id,started_by,phase,started_at,ends_at").eq("group_id", data.groupId).order("created_at", { ascending: false }).limit(1),
    ]);

    const userIds = Array.from(new Set([
      ...(members ?? []).map((m) => m.user_id),
      ...(messages ?? []).map((m) => m.author_id),
    ]));
    const { data: profiles } = userIds.length
      ? await context.supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] };

    return {
      group,
      members: members ?? [],
      messages: messages ?? [],
      resources: resources ?? [],
      events: events ?? [],
      alerts: alerts ?? [],
      pomodoro: pomodoro?.[0] ?? null,
      profiles: profiles ?? [],
    };
  });

// -------- Messages --------

export const sendGroupMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ groupId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("group_messages")
      .insert({ group_id: data.groupId, author_id: context.userId, body: data.body })
      .select("id,author_id,body,created_at")
      .single();
    if (error) throw error;
    return row;
  });

// -------- Resources --------

export const signResourceUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ groupId: z.string().uuid(), fileName: z.string().min(1).max(200) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    // ensure caller is a member
    const { data: m } = await context.supabase
      .from("group_members").select("id").eq("group_id", data.groupId).eq("user_id", context.userId).maybeSingle();
    if (!m) throw new Error("Non membre");
    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${data.groupId}/${Date.now()}_${safe}`;
    const { data: signed, error } = await context.supabase.storage
      .from("group-resources")
      .createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const registerResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      groupId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      storagePath: z.string().min(1),
      mimeType: z.string().max(100).optional(),
      sizeBytes: z.number().int().nonnegative().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("group_resources")
      .insert({
        group_id: data.groupId,
        uploader_id: context.userId,
        title: data.title,
        storage_path: data.storagePath,
        mime_type: data.mimeType ?? null,
        size_bytes: data.sizeBytes ?? null,
      })
      .select("id,uploader_id,title,storage_path,mime_type,size_bytes,created_at")
      .single();
    if (error) throw error;
    return row;
  });

export const signResourceDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ groupId: z.string().uuid(), path: z.string().min(1) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: m } = await context.supabase
      .from("group_members").select("id").eq("group_id", data.groupId).eq("user_id", context.userId).maybeSingle();
    if (!m) throw new Error("Non membre");
    const { data: signed, error } = await context.supabase.storage
      .from("group-resources").createSignedUrl(data.path, 60 * 60);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: r } = await context.supabase
      .from("group_resources").select("id,storage_path,group_id,uploader_id").eq("id", data.id).maybeSingle();
    if (!r) throw new Error("Introuvable");
    const { data: g } = await context.supabase.from("study_groups").select("owner_id").eq("id", r.group_id).maybeSingle();
    if (r.uploader_id !== context.userId && g?.owner_id !== context.userId) throw new Error("Non autorisé");
    await context.supabase.storage.from("group-resources").remove([r.storage_path]);
    await context.supabase.from("group_resources").delete().eq("id", data.id);
    return { ok: true };
  });

// -------- Events --------

export const createGroupEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      groupId: z.string().uuid(),
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().max(500).optional(),
      eventAt: z.string().datetime(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("group_events")
      .insert({
        group_id: data.groupId,
        created_by: context.userId,
        title: data.title,
        description: data.description ?? null,
        event_at: data.eventAt,
      })
      .select("id,created_by,title,description,event_at,created_at")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteGroupEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase.from("group_events").delete().eq("id", data.id);
    return { ok: true };
  });

// -------- Exam alerts with AI checklist + quiz --------

type AlertPayload = {
  checklist: { item: string; done?: boolean }[];
  quiz: { question: string; answer: string }[];
};

export const createExamAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      groupId: z.string().uuid(),
      subject: z.string().trim().min(1).max(80),
      examDate: z.string(),
      chapters: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");
    const gateway = createLovableAiGatewayProvider(key);

    const { data: g } = await context.supabase
      .from("study_groups").select("level").eq("id", data.groupId).maybeSingle();

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: `Tu prépares un groupe d'élèves algériens à un contrôle. Réponds UNIQUEMENT en JSON valide, sans texte autour :
{"checklist":[{"item":"..."}, ...], "quiz":[{"question":"...","answer":"..."}, ...]}
La checklist contient 6-10 tâches concrètes de révision. Le quiz contient 5 questions courtes avec leur réponse. Français.`,
      prompt: `Matière : ${data.subject}\nNiveau : ${g?.level ?? "?"}\nChapitres : ${data.chapters.join(", ")}\nDate du contrôle : ${data.examDate}`,
    });

    let parsed: AlertPayload = { checklist: [], quiz: [] };
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      throw new Error("Génération IA invalide, réessaie.");
    }

    const { data: row, error } = await context.supabase
      .from("group_exam_alerts")
      .insert({
        group_id: data.groupId,
        created_by: context.userId,
        subject: data.subject,
        exam_date: data.examDate,
        chapters: data.chapters,
        checklist: parsed.checklist as never,
        quiz: parsed.quiz as never,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteExamAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase.from("group_exam_alerts").delete().eq("id", data.id);
    return { ok: true };
  });

// -------- Pomodoro --------

export const startPomodoro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      groupId: z.string().uuid(),
      phase: z.enum(["focus", "break"]),
      durationMin: z.number().int().min(1).max(60),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const endsAt = new Date(Date.now() + data.durationMin * 60_000).toISOString();
    const { data: row, error } = await context.supabase
      .from("group_pomodoro_sessions")
      .insert({
        group_id: data.groupId,
        started_by: context.userId,
        phase: data.phase,
        ends_at: endsAt,
      })
      .select("id,started_by,phase,started_at,ends_at")
      .single();
    if (error) throw error;
    return row;
  });