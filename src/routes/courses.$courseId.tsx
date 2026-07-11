import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, PlayCircle, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/courses/$courseId")({
  component: CourseDetail,
});

type Course = {
  id: string; title: string; description: string | null;
  subject: string; level: string; price: number;
  trailer_video_url: string; teacher_id: string;
  rating_avg: number; enrolled_count: number;
};
type Video = { id: string; title: string; is_free_preview: boolean; video_url: string; order_index: number };

function CourseDetail() {
  const { courseId } = Route.useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase
        .from("courses")
        .select("id,title,description,subject,level,price,trailer_video_url,teacher_id,rating_avg,enrolled_count")
        .eq("id", courseId)
        .maybeSingle();
      if (!c) return;
      setCourse(c);
      const { data: v } = await supabase
        .from("course_videos")
        .select("id,title,is_free_preview,video_url,order_index")
        .eq("course_id", courseId)
        .order("order_index");
      setVideos(v ?? []);
      const { data: sig } = await supabase.storage.from("course-media").createSignedUrl(c.trailer_video_url, 3600);
      setTrailerUrl(sig?.signedUrl ?? null);
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        const { data: e } = await supabase.from("course_enrollments")
          .select("id").eq("course_id", courseId).eq("student_id", user.user.id).maybeSingle();
        setEnrolled(!!e);
      }
    })();
  }, [courseId]);

  if (!course) return <div className="p-10 text-center text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4">
          <Link to="/courses" className="flex items-center gap-2 text-sm hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Catalogue
          </Link>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <div className="aspect-video overflow-hidden rounded-2xl bg-black">
            {trailerUrl ? (
              <video src={trailerUrl} controls className="h-full w-full" />
            ) : (
              <div className="grid h-full place-items-center text-white/50">Chargement du trailer…</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{course.subject}</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{course.title}</h1>
            <p className="mt-3 text-muted-foreground">{course.description}</p>
          </div>
          <section>
            <h2 className="text-xl font-semibold">Contenu du cours</h2>
            <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
              {videos.length === 0 && (
                <div className="p-5 text-sm text-muted-foreground">Le prof n'a pas encore ajouté de vidéos.</div>
              )}
              {videos.map((v, i) => (
                <div key={v.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                    <span className="font-medium">{v.title}</span>
                  </div>
                  {enrolled || v.is_free_preview ? (
                    <PlayCircle className="h-5 w-5 text-primary" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="md:sticky md:top-6 h-fit rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="text-3xl font-bold">{course.price} <span className="text-base text-muted-foreground">DZD</span></div>
          <button
            disabled={enrolled}
            className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-90 disabled:opacity-60">
            {enrolled ? "Déjà inscrit" : "S'inscrire (paiement bientôt)"}
          </button>
          <div className="mt-4 space-y-1 text-sm text-muted-foreground">
            <div>⭐ {course.rating_avg.toFixed(1)} · {course.enrolled_count} inscrits</div>
            <div>🎬 {videos.length} vidéo{videos.length > 1 ? "s" : ""}</div>
            <div>🇩🇿 Programme algérien</div>
          </div>
        </aside>
      </main>
    </div>
  );
}