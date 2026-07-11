import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export const getSessionDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: session } = await context.supabase
      .from("live_sessions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!session) throw new Error("Session introuvable");

    const { count } = await context.supabase
      .from("session_bookings")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id)
      .in("status", ["booked", "attended"]);

    const { data: myBooking } = await context.supabase
      .from("session_bookings")
      .select("id,mode,status")
      .eq("session_id", session.id)
      .eq("student_id", context.userId)
      .maybeSingle();

    return {
      session,
      bookedCount: count ?? 0,
      myBooking,
      isTeacher: session.teacher_id === context.userId,
    };
  });

export const bookSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ sessionId: z.string().uuid(), mode: z.enum(["solo", "group"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: session } = await context.supabase
      .from("live_sessions")
      .select("id,max_students,session_type")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("Session introuvable");

    const { count } = await context.supabase
      .from("session_bookings")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id)
      .in("status", ["booked", "attended"]);
    if ((count ?? 0) >= session.max_students) {
      throw new Error("La session est complète");
    }

    const { error } = await context.supabase.from("session_bookings").insert({
      session_id: session.id,
      student_id: context.userId,
      status: "booked",
      mode: data.mode,
    });
    if (error) throw error;
    return { ok: true };
  });

export const sendLiveQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        question: z.string().min(1).max(1000),
        options: z.array(z.string().min(1).max(200)).min(2).max(6),
        correctAnswer: z.string().min(1).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: session } = await context.supabase
      .from("live_sessions")
      .select("teacher_id")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session || session.teacher_id !== context.userId) throw new Error("Non autorisé");

    // Close any currently open quiz
    await context.supabase
      .from("session_quizzes")
      .update({ closed_at: new Date().toISOString() })
      .eq("session_id", data.sessionId)
      .is("closed_at", null);

    const { data: row, error } = await context.supabase
      .from("session_quizzes")
      .insert({
        session_id: data.sessionId,
        question: data.question,
        options: data.options as never,
        correct_answer: data.correctAnswer,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const closeLiveQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ quizId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("session_quizzes")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", data.quizId);
    return { ok: true };
  });

export const answerLiveQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ quizId: z.string().uuid(), answer: z.string().min(1).max(200) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: quiz } = await context.supabase
      .from("session_quizzes")
      .select("id,correct_answer,closed_at")
      .eq("id", data.quizId)
      .maybeSingle();
    if (!quiz) throw new Error("Quiz introuvable");
    if (quiz.closed_at) throw new Error("Quiz clôturé");

    const isCorrect = data.answer.trim().toLowerCase() === quiz.correct_answer.trim().toLowerCase();
    // Upsert (student can update if not closed)
    const { error } = await context.supabase.from("quiz_responses").upsert(
      {
        quiz_id: data.quizId,
        student_id: context.userId,
        answer: data.answer,
        is_correct: isCorrect,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "quiz_id,student_id" },
    );
    if (error) throw error;
    return { ok: true, isCorrect };
  });

export const endSessionAndSummarize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");

    const { data: session } = await context.supabase
      .from("live_sessions")
      .select("id,teacher_id,subject,title")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session || session.teacher_id !== context.userId) throw new Error("Non autorisé");

    // Mark session ended
    await context.supabase
      .from("live_sessions")
      .update({ status: "completed" })
      .eq("id", session.id);

    const { data: quizzes } = await context.supabase
      .from("session_quizzes")
      .select("id,question,correct_answer,sent_at")
      .eq("session_id", session.id)
      .order("sent_at");
    const { data: responses } = await context.supabase
      .from("quiz_responses")
      .select("quiz_id,student_id,answer,is_correct")
      .in("quiz_id", (quizzes ?? []).map((q) => q.id));

    // Aggregate per student
    const perStudent: Record<string, { correct: number; total: number }> = {};
    for (const r of responses ?? []) {
      perStudent[r.student_id] ??= { correct: 0, total: 0 };
      perStudent[r.student_id].total += 1;
      if (r.is_correct) perStudent[r.student_id].correct += 1;
    }
    const totalResponses = (responses ?? []).length;
    const correctCount = (responses ?? []).filter((r) => r.is_correct).length;
    const globalRate = totalResponses ? Math.round((correctCount / totalResponses) * 100) : 0;

    const summaryInput = {
      title: session.title ?? session.subject,
      quizCount: (quizzes ?? []).length,
      globalRate,
      quizzes: (quizzes ?? []).map((q) => ({
        question: q.question,
        answers: (responses ?? []).filter((r) => r.quiz_id === q.id).length,
        correct: (responses ?? []).filter((r) => r.quiz_id === q.id && r.is_correct).length,
      })),
    };

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: `Tu produis un résumé bref (français, Markdown) d'une session live de tutorat.
Format :
## Résumé de la session
## Quiz envoyés (${summaryInput.quizCount})
## Taux de réussite global : ${summaryInput.globalRate}%
## Points à retravailler
- ...
Reste factuel et concis.`,
      prompt: JSON.stringify(summaryInput),
    });

    await context.supabase.from("session_summaries").insert({
      session_id: session.id,
      summary_markdown: text,
      stats: { globalRate, totalResponses, correctCount, quizCount: (quizzes ?? []).length },
      per_student: Object.entries(perStudent).map(([student_id, s]) => ({
        student_id,
        correct: s.correct,
        total: s.total,
        rate: s.total ? Math.round((s.correct / s.total) * 100) : 0,
      })),
    });

    return { summary: text, stats: summaryInput };
  });
