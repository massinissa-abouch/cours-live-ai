import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { notify } from "./notifications.server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function makePublicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getPublicSessionPreview = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const pub = makePublicClient();
    const { data: session } = await pub
      .from("live_sessions")
      .select("id,title,subject,scheduled_at,duration_min,session_type,max_students,price_per_student,status")
      .eq("id", data.id)
      .maybeSingle();
    if (!session) return null;
    const { count } = await pub
      .from("session_bookings")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id)
      .in("status", ["booked", "attended"]);
    return { session, bookedCount: count ?? 0 };
  });

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
      .select("id,max_students,session_type,scheduled_at,teacher_id,title,subject,status")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("Session introuvable");
    if (session.status === "cancelled" || session.status === "completed") {
      throw new Error("Cette session n'est plus disponible.");
    }
    if (new Date(session.scheduled_at).getTime() < Date.now()) {
      throw new Error("Ce créneau est déjà passé.");
    }

    // M2: check idempotent "already booked" BEFORE capacity
    const { data: existing } = await context.supabase
      .from("session_bookings")
      .select("id,status")
      .eq("session_id", session.id)
      .eq("student_id", context.userId)
      .maybeSingle();
    if (existing && existing.status !== "cancelled") {
      return { ok: true, alreadyBooked: true };
    }

    const { count } = await context.supabase
      .from("session_bookings")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id)
      .in("status", ["booked", "attended"]);
    if ((count ?? 0) >= session.max_students) {
      throw new Error("La session est complète");
    }
    const mode = session.session_type === "group" ? "group" : "solo";

    const { error } = await context.supabase.from("session_bookings").upsert({
      session_id: session.id,
      student_id: context.userId,
      status: "booked",
      mode,
    }, { onConflict: "session_id,student_id" });
    if (error) throw error;

    const label = session.title ?? session.subject;
    const when = new Date(session.scheduled_at).toLocaleString("fr-FR", {
      dateStyle: "short", timeStyle: "short",
    });
    await Promise.all([
      notify(context.userId, "booking_confirmed",
        "Réservation confirmée",
        `Ta session « ${label} » est confirmée pour le ${when}.`,
        `/live/${session.id}`),
      notify(session.teacher_id, "new_booking",
        "Nouvelle réservation",
        `Un élève vient de réserver ta session « ${label} ».`,
        `/live/${session.id}`),
    ]);

    return { ok: true, sessionId: session.id };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ bookingId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: b } = await context.supabase
      .from("session_bookings")
      .select("id,session_id,student_id,live_sessions(teacher_id,title,subject)")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!b) throw new Error("Réservation introuvable");
    const { error } = await context.supabase
      .from("session_bookings")
      .update({ status: "cancelled" })
      .eq("id", b.id);
    if (error) throw error;
    const s = b.live_sessions as { teacher_id: string; title: string | null; subject: string } | null;
    if (s) {
      const label = s.title ?? s.subject;
      await Promise.all([
        notify(b.student_id, "booking_cancelled", "Réservation annulée",
          `Ta réservation pour « ${label} » a été annulée.`),
        notify(s.teacher_id, "booking_cancelled", "Réservation annulée",
          `Une réservation pour « ${label} » a été annulée.`),
      ]);
    }
    return { ok: true };
  });

export const listTeacherSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ teacherId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const nowIso = new Date().toISOString();
    const { data: sessions } = await context.supabase
      .from("live_sessions")
      .select("id,title,subject,level,scheduled_at,duration_min,session_type,max_students,price_per_student,status")
      .eq("teacher_id", data.teacherId)
      .gte("scheduled_at", nowIso)
      .in("status", ["scheduled", "live"])
      .order("scheduled_at");
    const ids = (sessions ?? []).map((s) => s.id);
    const countsMap: Record<string, number> = {};
    if (ids.length) {
      const { data: bookings } = await context.supabase
        .from("session_bookings")
        .select("session_id,status")
        .in("session_id", ids)
        .in("status", ["booked", "attended"]);
      for (const b of bookings ?? []) {
        countsMap[b.session_id] = (countsMap[b.session_id] ?? 0) + 1;
      }
    }
    return (sessions ?? []).map((s) => ({
      ...s,
      booked: countsMap[s.id] ?? 0,
    }));
  });

export const createSessionSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      title: z.string().max(120).optional(),
      subject: z.string().min(1).max(80),
      level: z.string().min(1),
      scheduledAt: z.string(),
      durationMin: z.number().min(15).max(240),
      sessionType: z.enum(["solo", "group"]),
      maxStudents: z.number().min(1).max(5),
      pricePerStudent: z.number().min(0),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const scheduled = new Date(data.scheduledAt);
    if (isNaN(scheduled.getTime()) || scheduled.getTime() < Date.now()) {
      throw new Error("Choisis une date future.");
    }
    const maxS = data.sessionType === "solo" ? 1 : data.maxStudents;
    const { data: row, error } = await context.supabase
      .from("live_sessions")
      .insert({
        teacher_id: context.userId,
        title: data.title ?? null,
        subject: data.subject,
        level: data.level as never,
        scheduled_at: scheduled.toISOString(),
        duration_min: data.durationMin,
        session_type: data.sessionType,
        max_students: maxS,
        price_per_student: data.pricePerStudent,
        status: "scheduled",
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const listMyBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("session_bookings")
      .select("id,status,mode,live_sessions(id,title,subject,scheduled_at,duration_min,teacher_id,daily_room_url,status)")
      .eq("student_id", context.userId)
      .in("status", ["booked", "attended"]);
    return (data ?? []).map((b) => ({
      id: b.id,
      status: b.status,
      mode: b.mode,
      session: b.live_sessions,
    }));
  });

export const listTeacherBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: sessions } = await context.supabase
      .from("live_sessions")
      .select("id,title,subject,scheduled_at,duration_min,session_type,status")
      .eq("teacher_id", context.userId)
      .gte("scheduled_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order("scheduled_at");
    const ids = (sessions ?? []).map((s) => s.id);
    if (!ids.length) return [];
    const { data: bookings } = await context.supabase
      .from("session_bookings")
      .select("id,session_id,student_id,status,mode")
      .in("session_id", ids)
      .in("status", ["booked", "attended"]);
    const studentIds = Array.from(new Set((bookings ?? []).map((b) => b.student_id)));
    const { data: profiles } = studentIds.length
      ? await context.supabase.from("profiles").select("id,full_name,avatar_url").in("id", studentIds)
      : { data: [] };
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (sessions ?? []).map((s) => ({
      ...s,
      bookings: (bookings ?? []).filter((b) => b.session_id === s.id).map((b) => ({
        id: b.id,
        student_id: b.student_id,
        status: b.status,
        student: pMap.get(b.student_id) ?? null,
      })),
    }));
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
