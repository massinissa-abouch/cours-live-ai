import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ArrowLeft, Clock, Users, Video, ShieldCheck, ShieldAlert, Settings2 } from "lucide-react";
import { listTeacherBookings } from "@/lib/live-session.functions";

export const Route = createFileRoute("/_authenticated/teacher/")({
  component: TeacherHome,
});

type Course = {
  id: string;
  title: string;
  subject: string;
  status: string;
  price: number;
  enrolled_count: number;
};

function TeacherHome() {
  const { user } = Route.useRouteContext();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [verif, setVerif] = useState<string>("pending");
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof listTeacherBookings>>>([]);
  const loadBook = useServerFn(listTeacherBookings);

  useEffect(() => {
    (async () => {
      const [{ data }, { data: tp }, sess] = await Promise.all([
        supabase.from("courses").select("id,title,subject,status,price,enrolled_count")
          .eq("teacher_id", user.id).order("created_at", { ascending: false }),
        supabase.from("teacher_profiles").select("verification_status").eq("user_id", user.id).maybeSingle(),
        loadBook(),
      ]);
      setCourses(data ?? []);
      setVerif(tp?.verification_status ?? "pending");
      setSessions(sess);
      setLoading(false);
    })();
  }, [user.id, loadBook]);

  const totalStudents = new Set(sessions.flatMap((s) => s.bookings.map((b) => b.student_id))).size;
  const upcomingSessions = sessions.filter((s) => new Date(s.scheduled_at).getTime() >= Date.now() - 30 * 60_000);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <span className="text-sm font-semibold">Espace prof</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mes cours</h1>
            <p className="mt-1 text-sm text-muted-foreground">Publie tes séries vidéo avec un trailer gratuit.</p>
          </div>
          <Link to="/teacher/courses/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-90">
            <Plus className="h-4 w-4" /> Nouveau cours
          </Link>
        </div>

        <div className={`mt-6 flex items-center gap-3 rounded-2xl border p-4 ${verif === "verified" ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
          {verif === "verified" ? <ShieldCheck className="h-5 w-5 text-emerald-400" /> : <ShieldAlert className="h-5 w-5 text-amber-400" />}
          <div className="flex-1">
            <div className="text-sm font-semibold">
              {verif === "verified" ? "Profil vérifié" : "Vérification en cours"}
            </div>
            <div className="text-xs text-muted-foreground">
              {verif === "verified" ? "Ton badge vérifié est affiché aux élèves." : "Envoie ta pièce d'identité et un diplôme depuis l'onboarding pour être vérifié."}
            </div>
          </div>
          {verif !== "verified" && (
            <Link to="/onboarding" className="text-xs font-semibold text-primary hover:underline">Compléter →</Link>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat icon={Users} label="Élèves uniques" value={String(totalStudents)} />
          <Stat icon={Video} label="Sessions à venir" value={String(upcomingSessions.length)} />
          <Stat icon={Clock} label="Cours publiés" value={String(courses.filter((c) => c.status === "published").length)} />
        </div>

        <Link to="/teacher/availability"
          className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/30">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Mes créneaux de disponibilité</div>
              <div className="text-sm text-muted-foreground">Publie de vraies sessions live que les élèves pourront réserver.</div>
            </div>
          </div>
          <span className="text-primary">→</span>
        </Link>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Sessions & réservations</h2>
          {upcomingSessions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Aucune session à venir. Publie un créneau depuis « Mes créneaux ».</p>
          ) : (
            <div className="mt-3 grid gap-3">
              {upcomingSessions.map((s) => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{s.title ?? s.subject}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(s.scheduled_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} · {s.duration_min} min · {s.session_type}
                      </div>
                    </div>
                    <Link to="/live/$sessionId" params={{ sessionId: s.id }}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                      Ouvrir la salle
                    </Link>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.bookings.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Aucun inscrit pour l'instant.</span>
                    ) : s.bookings.map((b) => (
                      <span key={b.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                        {b.student?.full_name ?? `Élève ${b.student_id.slice(0,6)}`}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-8">
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">Aucun cours pour l'instant.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {courses.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                  <div>
                    <div className="font-semibold">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{c.subject} · {c.enrolled_count} inscrits</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">{c.price} DZD</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${c.status === "published" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {c.status}
                    </span>
                    <Link to="/teacher/courses/$courseId/chapters" params={{ courseId: c.id }}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:border-primary/40">
                      <Settings2 className="h-3 w-3" /> Chapitres
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}