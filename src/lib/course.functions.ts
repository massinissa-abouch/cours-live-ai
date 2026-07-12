import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notify } from "./notifications.server";

export const enrollCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ courseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: course } = await context.supabase
      .from("courses")
      .select("id,title,teacher_id,status")
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course) throw new Error("Cours introuvable");
    if (course.status !== "published") throw new Error("Ce cours n'est pas publié.");

    const { data: existing } = await context.supabase
      .from("course_enrollments")
      .select("id")
      .eq("course_id", course.id)
      .eq("student_id", context.userId)
      .maybeSingle();
    if (existing) return { ok: true, alreadyEnrolled: true };

    const { error } = await context.supabase.from("course_enrollments").insert({
      course_id: course.id,
      student_id: context.userId,
    });
    if (error) throw error;

    await Promise.all([
      notify(context.userId, "course_enrolled",
        "Inscription confirmée",
        `Tu as accès au cours « ${course.title} ».`,
        `/courses/${course.id}`),
      notify(course.teacher_id, "course_new_student",
        "Nouvel élève",
        `Un élève s'est inscrit à « ${course.title} ».`,
        `/teacher`),
    ]);
    return { ok: true };
  });

export const getVideoSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ videoId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: video } = await context.supabase
      .from("course_videos")
      .select("id,video_url,is_free_preview,course_id,courses(teacher_id)")
      .eq("id", data.videoId)
      .maybeSingle();
    if (!video) throw new Error("Vidéo introuvable");

    const isOwner = (video.courses as { teacher_id: string } | null)?.teacher_id === context.userId;
    if (!isOwner && !video.is_free_preview) {
      const { data: enrolled } = await context.supabase
        .from("course_enrollments")
        .select("id")
        .eq("course_id", video.course_id)
        .eq("student_id", context.userId)
        .maybeSingle();
      if (!enrolled) throw new Error("Inscris-toi pour accéder à cette vidéo.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sig, error } = await supabaseAdmin.storage
      .from("course-media")
      .createSignedUrl(video.video_url, 3600);
    if (error || !sig) throw new Error("Impossible d'ouvrir la vidéo.");
    return { url: sig.signedUrl };
  });

export const addCourseVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      courseId: z.string().uuid(),
      title: z.string().min(1).max(120),
      videoPath: z.string().min(1),
      isFreePreview: z.boolean(),
      orderIndex: z.number().min(0),
      durationSec: z.number().min(0).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: course } = await context.supabase
      .from("courses")
      .select("id,teacher_id")
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course || course.teacher_id !== context.userId) throw new Error("Non autorisé");
    const { data: row, error } = await context.supabase
      .from("course_videos")
      .insert({
        course_id: course.id,
        title: data.title,
        video_url: data.videoPath,
        is_free_preview: data.isFreePreview,
        order_index: data.orderIndex,
        duration_sec: data.durationSec ?? 0,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const listMyEnrollments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("course_enrollments")
      .select("id,progress_pct,enrolled_at,courses(id,title,subject,level,thumbnail_url,teacher_id)")
      .eq("student_id", context.userId)
      .order("enrolled_at", { ascending: false });
    return (data ?? []).map((e) => ({
      id: e.id,
      progress: e.progress_pct,
      enrolledAt: e.enrolled_at,
      course: e.courses,
    }));
  });