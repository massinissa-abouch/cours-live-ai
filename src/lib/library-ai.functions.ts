import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

// AI content cache shape stored in edu_chapters.ai_content (jsonb).
// { explanation, exercises: [{ question, correction }], eli5? }

type Exercise = { question: string; correction: string };
type ChapterAi = {
  explanation: string;
  exercises: Exercise[];
  eli5?: string;
  model?: string;
};

const ChapterIdInput = z.object({ chapterId: z.string().uuid() });

export const getChapterAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ChapterIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("edu_chapters")
      .select("id,title_fr,ai_content")
      .eq("id", data.chapterId)
      .maybeSingle();
    if (!row) throw new Error("Chapitre introuvable");
    return { content: (row.ai_content as ChapterAi | null) ?? null };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadChapterContext(supabase: any, chapterId: string) {
  const { data: chap } = await supabase
    .from("edu_chapters")
    .select("id,title_fr,summary_fr,subject_id")
    .eq("id", chapterId)
    .maybeSingle();
  if (!chap) throw new Error("Chapitre introuvable");
  const { data: subj } = await supabase
    .from("edu_subjects")
    .select("id,name_fr,level_id")
    .eq("id", chap.subject_id)
    .maybeSingle();
  const { data: lvl } = subj
    ? await supabase.from("edu_levels").select("label_fr").eq("id", subj.level_id).maybeSingle()
    : { data: null as { label_fr: string } | null };
  return {
    chapter: chap,
    subjectName: subj?.name_fr ?? "",
    levelLabel: lvl?.label_fr ?? "",
  };
}

const GenInput = z.object({
  chapterId: z.string().uuid(),
  eli5: z.boolean().optional(),
});

const ExerciseSchema = z.object({
  question: z.string(),
  correction: z.string(),
});

const GeneratedSchema = z.object({
  explanation: z.string(),
  exercises: z.array(ExerciseSchema),
});

const Eli5Schema = z.object({ eli5: z.string() });

export const generateChapterAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => GenInput.parse(i))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");

    const ctx = await loadChapterContext(context.supabase, data.chapterId);

    // Read existing cache to preserve fields.
    const existing =
      ((await context.supabase
        .from("edu_chapters")
        .select("ai_content")
        .eq("id", data.chapterId)
        .maybeSingle()).data?.ai_content as ChapterAi | null) ?? null;

    const gateway = createLovableAiGatewayProvider(key);
    // Highest quality Gemini available in the gateway catalog.
    const model = gateway("google/gemini-3.1-pro-preview");

    // Admin client required because edu_chapters UPDATE policy is admin-only.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.eli5) {
      if (!existing) throw new Error("Génère d'abord l'explication.");
      let eli5Text = "";
      try {
        const { output } = await generateText({
          model,
          output: Output.object({ schema: Eli5Schema }),
          system: `Tu es Ostadi, tuteur IA pour élèves algériens. Réponds en français simple (niveau ELI5, comme à un enfant de 10 ans).
Utilise Markdown (### titres, listes, **gras**). Formules LaTeX \\( ... \\) si nécessaire.`,
          prompt: `Réexplique le chapitre "${ctx.chapter.title_fr}" (${ctx.subjectName}, ${ctx.levelLabel}) de façon TRÈS SIMPLE, avec des analogies du quotidien. Reste rigoureux mais accessible.`,
        });
        eli5Text = output.eli5;
      } catch (error) {
        if (NoObjectGeneratedError.isInstance(error)) eli5Text = error.text ?? "";
        else throw error;
      }
      const next: ChapterAi = { ...existing, eli5: eli5Text };
      await supabaseAdmin
        .from("edu_chapters")
        .update({ ai_content: next as never, ai_generated_at: new Date().toISOString() })
        .eq("id", data.chapterId);
      return { content: next };
    }

    let generated: { explanation: string; exercises: Exercise[] };
    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: GeneratedSchema }),
        system: `Tu es Ostadi, tuteur IA rigoureux pour élèves algériens (programme officiel).
Réponds en français. Utilise Markdown (### titres, listes, **gras**). Formules mathématiques en LaTeX inline \\( ... \\) ou bloc $$ ... $$.
Structure de l'explication : introduction, définitions clés, points essentiels, exemple résolu, à retenir.
Fournis EXACTEMENT 3 exercices progressifs (facile / moyen / plus corsé) adaptés au niveau. Chaque correction est complète et pédagogique.`,
        prompt: `Chapitre : "${ctx.chapter.title_fr}"
Matière : ${ctx.subjectName}
Niveau : ${ctx.levelLabel}
${ctx.chapter.summary_fr ? `Résumé officiel : ${ctx.chapter.summary_fr}` : ""}

Produis :
1. Une explication complète et structurée du chapitre.
2. Exactement 3 exercices d'application avec correction détaillée.`,
      });
      generated = {
        explanation: output.explanation,
        exercises: output.exercises.slice(0, 3),
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        try {
          const parsed = JSON.parse(error.text ?? "{}");
          generated = {
            explanation: String(parsed.explanation ?? ""),
            exercises: Array.isArray(parsed.exercises) ? parsed.exercises.slice(0, 3) : [],
          };
        } catch {
          throw new Error("La génération IA a échoué, réessaie.");
        }
      } else {
        throw error;
      }
    }

    const next: ChapterAi = {
      explanation: generated.explanation,
      exercises: generated.exercises,
      eli5: existing?.eli5,
      model: "google/gemini-3.1-pro-preview",
    };

    await supabaseAdmin
      .from("edu_chapters")
      .update({ ai_content: next as never, ai_generated_at: new Date().toISOString() })
      .eq("id", data.chapterId);

    return { content: next };
  });

export const completeChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ChapterIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: gam } = await context.supabase
      .from("gamification")
      .select("chapters_completed")
      .eq("student_id", context.userId)
      .maybeSingle();
    const list = Array.isArray(gam?.chapters_completed)
      ? (gam!.chapters_completed as string[])
      : [];
    if (list.includes(data.chapterId)) return { alreadyCompleted: true, total: list.length };
    const next = [...list, data.chapterId];
    await context.supabase
      .from("gamification")
      .upsert(
        { student_id: context.userId, chapters_completed: next as never },
        { onConflict: "student_id" },
      );
    // Trigger streak (existing logic).
    await context.supabase.rpc("ping_streak", { _user: context.userId });
    return { alreadyCompleted: false, total: next.length };
  });