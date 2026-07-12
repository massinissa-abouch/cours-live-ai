import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Creates (or reuses) a Daily.co room for a live session. Callable by the
// teacher or by a booked student.
export const getOrCreateDailyRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: session, error } = await context.supabase
      .from("live_sessions")
      .select("id, teacher_id, scheduled_at, duration_min, daily_room_url, allow_recording")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error || !session) throw new Error("Session introuvable");

    const isTeacher = session.teacher_id === context.userId;
    if (!isTeacher) {
      const { data: booking } = await context.supabase
        .from("session_bookings")
        .select("id")
        .eq("session_id", session.id)
        .eq("student_id", context.userId)
        .in("status", ["booked", "attended"])
        .maybeSingle();
      if (!booking) throw new Error("Tu n'es pas inscrit à cette session.");
    }

    // Only allow joining from 15 minutes before scheduled_at
    const start = new Date(session.scheduled_at).getTime();
    const now = Date.now();
    const openAt = start - 15 * 60 * 1000;
    if (now < openAt) {
      const mins = Math.ceil((openAt - now) / 60000);
      throw new Error(`La salle ouvrira ${mins} min avant l'heure du créneau.`);
    }

    if (session.daily_room_url) return { url: session.daily_room_url };

    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) throw new Error("Configuration visio manquante.");

    // Room name safe for Daily
    const roomName = `ostadi-${session.id.slice(0, 8)}-${Date.now().toString(36)}`;
    const exp = Math.floor((start + (session.duration_min + 30) * 60 * 1000) / 1000);

    const res = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        privacy: "public",
        properties: {
          exp,
          enable_screenshare: true,
          enable_chat: true,
          start_video_off: false,
          start_audio_off: false,
          enable_recording: session.allow_recording ? "cloud" : undefined,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[daily] create room failed", res.status, text);
      throw new Error("Impossible de créer la salle visio.");
    }
    const room = (await res.json()) as { url: string };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("live_sessions")
      .update({ daily_room_url: room.url })
      .eq("id", session.id);

    return { url: room.url };
  });