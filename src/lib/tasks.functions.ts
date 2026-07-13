import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AnalyzeInput = z.object({
  title: z.string().min(1).max(200).optional(),
  sourceText: z.string().max(4000).optional(),
  imageDataUrl: z.string().max(6_000_000).optional(),
  level: z.string().max(40).optional(),
});

/** Analyse un énoncé (photo ou texte) : matière, chapitre, difficulté, durée, plan de résolution. */
export const analyzeTaskSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AnalyzeInput.parse(i))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `Tu es un tuteur du programme scolaire algérien (BEM/BAC/université).
À partir d'un énoncé ou d'une photo d'exercice, extrais des métadonnées utiles pour planifier le travail.
Réponds STRICTEMENT en JSON valide, sans texte autour, avec ce schéma :
{
  "title": string,              // titre court (max 80 caractères), en français
  "subject": string,            // matière (ex: "Mathématiques", "Physique", "Français")
  "chapter": string,            // chapitre estimé
  "difficulty": 1|2|3|4|5,      // 1 très facile, 5 très corsé
  "estimated_minutes": number,  // durée réaliste pour un élève moyen (5..300)
  "steps": [string, ...],       // 3 à 6 étapes de résolution suggérées
  "hint": string,               // 1 indice pour démarrer
  "confidence": "low"|"medium"|"high"
}`;

    const userText = [
      data.title ? `Titre fourni : ${data.title}` : null,
      data.level ? `Niveau : ${data.level}` : null,
      data.sourceText ? `Énoncé :\n${data.sourceText}` : null,
      data.imageDataUrl ? "Une photo est fournie. Analyse-la attentivement." : null,
    ].filter(Boolean).join("\n");

    const content: Array<{ type: "text"; text: string } | { type: "image"; image: string }> = [
      { type: "text", text: userText || "Analyse générique." },
    ];
    if (data.imageDataUrl) content.push({ type: "image", image: data.imageDataUrl });

    const { text } = await generateText({
      model,
      system,
      messages: [{ role: "user", content }],
    });

    // Extract JSON robustly
    const cleaned = text.replace(/```json\s*|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(match ? match[0] : cleaned); } catch { parsed = {}; }

    const asStr = (v: unknown, fb = "") => typeof v === "string" ? v : fb;
    const asNum = (v: unknown, fb: number) => typeof v === "number" && Number.isFinite(v) ? v : fb;
    const steps = Array.isArray(parsed.steps) ? parsed.steps.filter((s): s is string => typeof s === "string").slice(0, 6) : [];

    return {
      title: asStr(parsed.title, data.title ?? "Exercice à faire").slice(0, 80),
      subject: asStr(parsed.subject, "Autre").slice(0, 60),
      chapter: asStr(parsed.chapter, "").slice(0, 120),
      difficulty: Math.min(5, Math.max(1, Math.round(asNum(parsed.difficulty, 3)))) as 1|2|3|4|5,
      estimated_minutes: Math.min(300, Math.max(5, Math.round(asNum(parsed.estimated_minutes, 30)))),
      steps,
      hint: asStr(parsed.hint, ""),
      confidence: (parsed.confidence === "low" || parsed.confidence === "high") ? parsed.confidence : "medium" as const,
    };
  });

const CreateInput = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().max(60).optional(),
  chapter: z.string().max(120).optional(),
  level: z.string().max(40).optional(),
  difficulty: z.number().int().min(1).max(5).default(3),
  estimated_minutes: z.number().int().min(5).max(600).default(30),
  notes: z.string().max(2000).optional(),
  due_at: z.string().datetime().nullable().optional(),
  reminder_at: z.string().datetime().nullable().optional(),
  source_type: z.enum(["manual","photo","text","import"]).default("manual"),
  source_content: z.string().max(4000).optional(),
  ai_analysis: z.record(z.string(), z.unknown()).optional(),
  group_id: z.string().uuid().nullable().optional(),
  share_with_group: z.boolean().default(false),
  channels: z.array(z.enum(["inapp","email","push","sms"])).default(["inapp"]),
});

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("student_tasks")
      .insert({
        student_id: context.userId,
        title: data.title,
        subject: data.subject ?? null,
        chapter: data.chapter ?? null,
        level: data.level ?? null,
        difficulty: data.difficulty,
        estimated_minutes: data.estimated_minutes,
        notes: data.notes ?? null,
        due_at: data.due_at ?? null,
        reminder_at: data.reminder_at ?? null,
        source_type: data.source_type,
        source_content: data.source_content ?? null,
        ai_analysis: data.ai_analysis ?? null,
        group_id: data.group_id ?? null,
        share_with_group: data.share_with_group && !!data.group_id,
        channels: data.channels,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const listMyTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    status: z.enum(["all","open","done"]).default("all"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("student_tasks").select("*").eq("student_id", context.userId);
    if (data.status === "open") q = q.in("status", ["todo","in_progress"]);
    if (data.status === "done") q = q.eq("status", "done");
    const { data: rows, error } = await q.order("priority_score", { ascending: false }).limit(200);
    if (error) throw error;
    return rows ?? [];
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    patch: z.object({
      title: z.string().min(1).max(200).optional(),
      subject: z.string().max(60).nullable().optional(),
      chapter: z.string().max(120).nullable().optional(),
      difficulty: z.number().int().min(1).max(5).optional(),
      estimated_minutes: z.number().int().min(5).max(600).optional(),
      notes: z.string().max(2000).nullable().optional(),
      due_at: z.string().datetime().nullable().optional(),
      reminder_at: z.string().datetime().nullable().optional(),
      status: z.enum(["todo","in_progress","done","skipped"]).optional(),
      actual_minutes: z.number().int().min(0).max(1000).nullable().optional(),
      self_grade: z.number().int().min(0).max(20).nullable().optional(),
      share_with_group: z.boolean().optional(),
      group_id: z.string().uuid().nullable().optional(),
      channels: z.array(z.enum(["inapp","email","push","sms"])).optional(),
    }),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { ...data.patch };
    if (patch.status === "done" && patch.completed_at === undefined) {
      patch.completed_at = new Date().toISOString();
    }
    const { data: row, error } = await context.supabase
      .from("student_tasks")
      .update(patch)
      .eq("id", data.id)
      .eq("student_id", context.userId)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("student_tasks")
      .delete()
      .eq("id", data.id)
      .eq("student_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/** Sauvegarde/écrase l'inscription Web-Push d'un appareil pour l'utilisateur courant. */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    endpoint: z.string().url(),
    p256dh: z.string().min(1),
    auth_key: z.string().min(1),
    user_agent: z.string().max(300).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    const { error } = await context.supabase.from("push_subscriptions").insert({
      user_id: context.userId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth_key: data.auth_key,
      user_agent: data.user_agent ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });