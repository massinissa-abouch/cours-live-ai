import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

// -------- Fiches de révision --------

export const listRevisionSheets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ai_revision_sheets")
      .select("id,title,subject,chapter,created_at")
      .eq("student_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const getRevisionSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("ai_revision_sheets")
      .select("*")
      .eq("id", data.id)
      .eq("student_id", context.userId)
      .maybeSingle();
    if (!row) throw new Error("Fiche introuvable");
    return row;
  });

export const generateRevisionSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ conversationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");

    const { data: conv } = await context.supabase
      .from("ai_conversations")
      .select("subject,level,chapter,title")
      .eq("id", data.conversationId)
      .eq("student_id", context.userId)
      .maybeSingle();
    if (!conv) throw new Error("Conversation introuvable");

    const { data: msgs } = await context.supabase
      .from("ai_messages")
      .select("role,content")
      .eq("conversation_id", data.conversationId)
      .order("created_at");

    const transcript = (msgs ?? [])
      .map((m) => `${m.role === "user" ? "Élève" : "Ostadi"} : ${m.content}`)
      .join("\n\n");

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: `Tu es un tuteur pour élèves algériens. Produis une FICHE DE RÉVISION structurée en français, à partir d'une conversation d'entraînement.
Format Markdown STRICT :
# Fiche de révision — <titre du chapitre>
## Objectifs
## Définitions clés
## Formules à retenir
## Méthodes / étapes types
## Exemples résolus
## Erreurs fréquentes à éviter
## Mini-exercices d'auto-évaluation (3-5)`,
      prompt: `Matière : ${conv.subject ?? "?"}\nNiveau : ${conv.level ?? "?"}\nChapitre : ${conv.chapter ?? "?"}\n\nCONVERSATION :\n${transcript}`,
    });

    const title = `${conv.chapter || conv.subject || "Fiche"} — ${new Date().toLocaleDateString("fr-FR")}`;
    const { data: row, error } = await context.supabase
      .from("ai_revision_sheets")
      .insert({
        student_id: context.userId,
        conversation_id: data.conversationId,
        title,
        subject: conv.subject,
        chapter: conv.chapter,
        content_markdown: text,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id, content: text };
  });

// -------- Mode Contrôle chronométré --------

const ExamCreateInput = z.object({
  subject: z.string().min(1).max(80),
  level: z.string().max(40).optional(),
  chapter: z.string().max(120).optional(),
  durationMin: z.number().int().min(5).max(120).default(20),
  questionCount: z.number().int().min(3).max(15).default(6),
  difficulty: z.number().int().min(1).max(5).default(3),
});

type ExamQuestion = { id: string; question: string; kind: "open" | "mcq"; options?: string[] };

export const createExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ExamCreateInput.parse(i))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: `Tu génères un mini-contrôle pour élève algérien. Réponds UNIQUEMENT en JSON valide, sans texte autour, sans balises markdown.
Format exact :
{"questions":[{"id":"q1","kind":"open","question":"..."},{"id":"q2","kind":"mcq","question":"...","options":["A","B","C","D"]}]}
Mélange des questions ouvertes (kind:"open") et QCM (kind:"mcq" avec 4 options). Difficulté ${data.difficulty}/5.
Génère exactement ${data.questionCount} questions en français, alignées sur le programme algérien.`,
      prompt: `Matière : ${data.subject}\nNiveau : ${data.level ?? "?"}\nChapitre : ${data.chapter ?? "?"}`,
    });

    let questions: ExamQuestion[] = [];
    try {
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { questions: ExamQuestion[] };
      questions = parsed.questions;
    } catch {
      throw new Error("Génération invalide, réessaie.");
    }
    if (!questions.length) throw new Error("Aucune question générée");

    const { data: row, error } = await context.supabase
      .from("ai_exams")
      .insert({
        student_id: context.userId,
        subject: data.subject,
        level: data.level ?? null,
        chapter: data.chapter ?? null,
        duration_min: data.durationMin,
        questions: questions as unknown as object,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id, questions, durationMin: data.durationMin };
  });

export const getExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("ai_exams")
      .select("*")
      .eq("id", data.id)
      .eq("student_id", context.userId)
      .maybeSingle();
    if (!row) throw new Error("Examen introuvable");
    return row;
  });

const SubmitExamInput = z.object({
  id: z.string().uuid(),
  answers: z.record(z.string(), z.string().max(4000)),
});

export const submitExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SubmitExamInput.parse(i))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");

    const { data: exam } = await context.supabase
      .from("ai_exams")
      .select("subject,level,chapter,questions")
      .eq("id", data.id)
      .eq("student_id", context.userId)
      .maybeSingle();
    if (!exam) throw new Error("Examen introuvable");

    const questions = exam.questions as unknown as ExamQuestion[];
    const payload = questions
      .map((q) => `${q.id} (${q.kind}) — ${q.question}\nRéponse élève : ${data.answers[q.id] ?? "(vide)"}`)
      .join("\n\n");

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: `Tu es un correcteur bienveillant. Corrige chaque réponse. Réponds UNIQUEMENT en JSON valide :
{"score": <sur 20>, "items":[{"id":"q1","score":<0-3>,"comment":"...","correction":"..."}]}
Barème : chaque question sur 3 points, note finale ramenée sur 20.`,
      prompt: `Matière : ${exam.subject}\nNiveau : ${exam.level ?? "?"}\nChapitre : ${exam.chapter ?? "?"}\n\n${payload}`,
    });

    let grading: { score: number; items: Array<{ id: string; score: number; comment: string; correction: string }> };
    try {
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      grading = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    } catch {
      throw new Error("Correction invalide");
    }

    await context.supabase
      .from("ai_exams")
      .update({
        answers: data.answers as unknown as object,
        grading: grading as unknown as object,
        score: grading.score,
        finished_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("student_id", context.userId);

    return grading;
  });
