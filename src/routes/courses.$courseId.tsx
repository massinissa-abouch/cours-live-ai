import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, PlayCircle, Lock, Star, Users, Clock, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { enrollCourse, getVideoSignedUrl } from "@/lib/course.functions";
import { toast } from "sonner";

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
type Review = { id: string; rating: number; comment: string | null; created_at: string; student_id: string };

function CourseDetail() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const enroll = useServerFn(enrollCourse);
  const getVid = useServerFn(getVideoSignedUrl);
  const [course, setCourse] = useState<Course | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [teacherName, setTeacherName] = useState<string>("");
  const [teacherAvatar, setTeacherAvatar] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeChapter, setActiveChapter] = useState(0);
  const [chapterUrl, setChapterUrl] = useState<string | null>(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [authed, setAuthed] = useState<boolean>(false);

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
      const { data: prof } = await supabase.from("profiles")
        .select("full_name,avatar_url").eq("id", c.teacher_id).maybeSingle();
      setTeacherName(prof?.full_name ?? "Professeur");
      setTeacherAvatar(prof?.avatar_url ?? null);
      const { data: rvs } = await supabase.from("course_reviews")
        .select("id,rating,comment,created_at,student_id").eq("course_id", courseId)
        .order("created_at", { ascending: false }).limit(6);
      setReviews(rvs ?? []);
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        setAuthed(true);
        const { data: e } = await supabase.from("course_enrollments")
          .select("id").eq("course_id", courseId).eq("student_id", user.user.id).maybeSingle();
        setEnrolled(!!e);
      }
    })();
  }, [courseId]);

  useEffect(() => {
    setChapterUrl(null);
    const v = videos[activeChapter];
    if (!v) return;
    if (!enrolled && !v.is_free_preview) return;
    (async () => {
      setChapterLoading(true);
      try {
        const res = await getVid({ data: { videoId: v.id } });
        setChapterUrl(res.url);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur vidéo");
      } finally {
        setChapterLoading(false);
      }
    })();
  }, [activeChapter, videos, enrolled, getVid]);

  async function handleEnroll() {
    if (!authed) {
      navigate({ to: "/auth", search: { mode: "signup", role: "student" } });
      return;
    }
    setEnrolling(true);
    try {
      await enroll({ data: { courseId } });
      setEnrolled(true);
      toast.success("Inscription confirmée ✓");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setEnrolling(false);
    }
  }

  const stats = useMemo(() => ({
    duration: videos.length * 12,
    chapters: videos.length,
  }), [videos]);

  if (!course) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="text-sm text-muted-foreground">Chargement…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]" />

      <header className="relative z-10 border-b border-border/60 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Link to="/courses" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Marketplace
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-10">
        {/* Hero */}
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="relative aspect-video overflow-hidden rounded-3xl border border-border/60 bg-black shadow-[0_30px_80px_-30px_hsl(var(--primary)/0.5)]">
              {trailerUrl ? (
                <video src={trailerUrl} controls className="h-full w-full" />
              ) : (
                <div className="grid h-full place-items-center text-white/40">Chargement du trailer…</div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 font-medium text-primary">
                  {course.subject}
                </span>
                <span className="rounded-full border border-border/60 bg-card/50 px-2.5 py-1 uppercase tracking-wide text-muted-foreground">
                  {course.level.replace(/_/g, " ")}
                </span>
                {course.rating_avg >= 4.5 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-medium text-amber-300">
                    <Sparkles className="h-3 w-3" /> Coup de cœur
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{course.title}</h1>
              <p className="mt-3 text-muted-foreground leading-relaxed">{course.description}</p>

              <div className="mt-5 flex flex-wrap items-center gap-5 text-sm">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <b className="text-foreground">{course.rating_avg.toFixed(1)}</b> ({reviews.length} avis)
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-4 w-4" /> {course.enrolled_count} inscrits
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-4 w-4" /> ~{stats.duration} min
                </span>
              </div>

              {/* Teacher card */}
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border/60 bg-card/40 p-3 backdrop-blur">
                <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-primary/15 text-primary font-semibold">
                  {teacherAvatar ? <img src={teacherAvatar} alt={teacherName} className="h-full w-full object-cover" /> : teacherName.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold">{teacherName}</div>
                  <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3 w-3 text-emerald-400" /> Prof vérifié
                  </div>
                </div>
              </div>
            </div>

            {/* Chapter timeline */}
            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Programme du cours</h2>
                <span className="text-xs text-muted-foreground">{stats.chapters} chapitre{stats.chapters > 1 ? "s" : ""}</span>
              </div>
              <div className="mt-4 overflow-hidden rounded-3xl border border-border/60 bg-card/40 backdrop-blur">
                {videos.length === 0 && (
                  <div className="p-6 text-sm text-muted-foreground">Le prof n'a pas encore ajouté de vidéos.</div>
                )}
                {videos.map((v, i) => {
                  const unlocked = enrolled || v.is_free_preview;
                  const active = activeChapter === i;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setActiveChapter(i)}
                      className={`group flex w-full items-center gap-4 border-t border-border/50 p-4 text-left transition first:border-t-0 hover:bg-primary/5 ${active ? "bg-primary/5" : ""}`}
                    >
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-semibold transition ${
                        unlocked ? "bg-primary/15 text-primary" : "bg-secondary/60 text-muted-foreground"
                      }`}>
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{v.title}</div>
                        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> ~12 min</span>
                          {v.is_free_preview && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                              Preview gratuit
                            </span>
                          )}
                        </div>
                      </div>
                      {unlocked ? (
                        <PlayCircle className="h-5 w-5 text-primary transition group-hover:scale-110" />
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* What you'll learn */}
            <section className="rounded-3xl border border-border/60 bg-card/40 p-6 backdrop-blur">
              <h2 className="text-xl font-semibold">Ce que tu vas apprendre</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  "Maîtriser les concepts clés du programme",
                  "Techniques de résolution rapide",
                  "Erreurs classiques à éviter",
                  "Méthode pour l'examen officiel",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="text-muted-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Reviews */}
            {reviews.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold">Avis des élèves</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
                      <div className="flex items-center gap-1 text-amber-400">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-current" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                      {r.comment && <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{r.comment}</p>}
                      <div className="mt-2 text-[11px] text-muted-foreground/70">
                        {new Date(r.created_at).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sticky pricing */}
          <aside className="lg:sticky lg:top-6 h-fit space-y-4">
            <div className="rounded-3xl border border-border/60 bg-card/60 p-6 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.35)] backdrop-blur-xl">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight">{course.price}</span>
                <span className="text-sm text-muted-foreground">DZD</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Accès à vie · Mises à jour incluses</div>

              <button
                disabled={enrolled}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-primary to-primary/80 px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enrolled ? "Déjà inscrit ✓" : "S'inscrire au cours"}
              </button>
              <div className="mt-2 text-center text-[11px] text-muted-foreground">Paiement sécurisé · Bientôt disponible</div>

              <div className="mt-6 space-y-3 text-sm">
                {[
                  { icon: PlayCircle, text: `${stats.chapters} vidéos HD` },
                  { icon: Clock, text: `~${stats.duration} min de contenu` },
                  { icon: ShieldCheck, text: "Prof vérifié" },
                  { icon: Sparkles, text: "Quiz IA inclus" },
                ].map((f) => (
                  <div key={f.text} className="flex items-center gap-2 text-muted-foreground">
                    <f.icon className="h-4 w-4 text-primary" /> {f.text}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}