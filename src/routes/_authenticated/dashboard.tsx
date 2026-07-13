import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Video, Sparkles, LogOut, GraduationCap, Bell, Clock, ShieldAlert, TrendingUp, Wrench, Archive, Flame, Gift, Users, MessageSquare, ListChecks } from "lucide-react";
import { listMyEnrollments } from "@/lib/course.functions";
import { listMyBookings } from "@/lib/live-session.functions";
import { listMyNotifications, markNotificationRead } from "@/lib/notifications.functions";
import { getAiCostSummary } from "@/lib/ai-cost.functions";
import { pingStreak, getGrowthStatus } from "@/lib/growth.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type EnrollmentRow = { id: string; progress: number; course: { id: string; title: string; subject: string; level: string; thumbnail_url: string | null; teacher_id: string } | null };
type BookingRow = { id: string; status: string; mode: string; session: { id: string; title: string | null; subject: string; scheduled_at: string; duration_min: number; teacher_id: string; status: string } | null };
type Notif = Awaited<ReturnType<typeof listMyNotifications>>[number];

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [isTeacher, setIsTeacher] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [aiCost, setAiCost] = useState<Awaited<ReturnType<typeof getAiCostSummary>> | null>(null);
  const [growth, setGrowth] = useState<Awaited<ReturnType<typeof getGrowthStatus>> | null>(null);
  const loadEnroll = useServerFn(listMyEnrollments);
  const loadBooks = useServerFn(listMyBookings);
  const loadNotif = useServerFn(listMyNotifications);
  const markRead = useServerFn(markNotificationRead);
  const loadCost = useServerFn(getAiCostSummary);
  const ping = useServerFn(pingStreak);
  const loadGrowth = useServerFn(getGrowthStatus);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: prof } = await supabase
        .from("student_profiles").select("school_level").eq("user_id", user.id).maybeSingle();
      if (!prof?.school_level) { navigate({ to: "/onboarding" }); return; }
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id);
      setIsTeacher((roles ?? []).some((r) => r.role === "teacher"));
      const admin = (roles ?? []).some((r) => r.role === "admin");
      setIsAdmin(admin);
      const [e, b, n] = await Promise.all([loadEnroll(), loadBooks(), loadNotif()]);
      setEnrollments(e as EnrollmentRow[]);
      setBookings(b as BookingRow[]);
      setNotifs(n);
      if (admin) {
        try { setAiCost(await loadCost()); } catch { /* ignore */ }
      }
      try {
        await ping();
        setGrowth(await loadGrowth());
      } catch { /* ignore */ }
    })();
  }, [user.id, navigate, loadEnroll, loadBooks, loadNotif, loadCost, ping, loadGrowth]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const now = Date.now();
  const upcoming = bookings
    .filter((b) => b.session && new Date(b.session.scheduled_at).getTime() >= now - 30 * 60_000)
    .sort((a, b) => new Date(a.session!.scheduled_at).getTime() - new Date(b.session!.scheduled_at).getTime());
  const past = bookings
    .filter((b) => b.session && new Date(b.session.scheduled_at).getTime() < now - 30 * 60_000);
  const unread = notifs.filter((n) => !n.read_at).length;

  const cards = [
    { icon: ListChecks, title: "Cahier de textes", desc: "Photo → IA planifie et te rappelle avant l'échéance", to: "/tools/homework" as const },
    { icon: BookOpen, title: "Catalogue de cours", desc: "Trouve un cours vidéo", to: "/courses" as const },
    { icon: Video, title: "Trouver un prof", desc: "Réserve une session live", to: "/teachers" as const },
    { icon: Sparkles, title: "Entraînement IA", desc: "Génère un exercice", to: "/ai" as const },
    { icon: Wrench, title: "Outils élève", desc: "Moyenne, compte à rebours, banque d'exercices", to: "/tools" as const },
    { icon: Archive, title: "Archive Bac & BEM", desc: "Sujets et corrigés officiels", to: "/archive" as const },
    { icon: Users, title: "Groupes de révision", desc: "Chat, ressources & Pomodoro entre camarades", to: "/groups" as const },
    { icon: MessageSquare, title: "Communauté", desc: "Pose une question aux autres élèves", to: "/community" as const },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">أ</div>
            <span className="font-semibold">Ostadi</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => { setShowNotifs((s) => !s); if (unread) markRead({ data: { all: true } }).then(() => setNotifs((ns) => ns.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))); }}
                className="relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary">
                <Bell className="h-4 w-4" />
                {unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground grid place-items-center">{unread}</span>}
              </button>
              {showNotifs && (
                <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-2xl border border-border bg-card p-2 shadow-xl">
                  {notifs.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">Aucune notification.</div>
                  ) : notifs.slice(0, 8).map((n) => (
                    <Link key={n.id} to={n.link ?? "/dashboard"} onClick={() => setShowNotifs(false)}
                      className="block rounded-lg px-3 py-2 hover:bg-secondary">
                      <div className="text-sm font-medium">{n.title}</div>
                      {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                      <div className="text-[10px] text-muted-foreground/70">{new Date(n.created_at).toLocaleString("fr-FR")}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <button onClick={signOut} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary">
              <LogOut className="h-4 w-4" /> Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">
          Bonjour {user.user_metadata?.full_name ?? user.email} 👋
        </h1>
        <p className="mt-2 text-muted-foreground">Que veux-tu faire aujourd'hui ?</p>

        {growth && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/40 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-600 dark:text-orange-300">
              <Flame className="h-4 w-4" />
              {growth.streakDays > 0 ? `${growth.streakDays} jour${growth.streakDays > 1 ? "s" : ""} de suite` : "Commence ton streak aujourd'hui !"}
            </div>
            {growth.perkActive && (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" /> Accès illimité actif
              </div>
            )}
            <Link to="/invite" className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/15">
              <Gift className="h-3.5 w-3.5" /> Invite 3 amis → +7 jours ({growth.acceptedCount}/3)
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {cards.map((c) => (
            <Link
              key={c.title} to={c.to}
              className="group rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
            </Link>
          ))}
        </div>

        {isTeacher && (
          <Link to="/teacher"
            className="mt-6 flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 p-5 transition hover:bg-primary/10">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-6 w-6 text-primary" />
              <div>
                <div className="font-semibold">Espace prof</div>
                <div className="text-sm text-muted-foreground">Publie tes cours et gère tes créneaux</div>
              </div>
            </div>
            <span className="text-primary">→</span>
          </Link>
        )}

        {isAdmin && aiCost && (
          <Link to="/admin"
            className={`mt-6 flex items-center justify-between rounded-2xl border p-5 transition ${
              aiCost.overBudget
                ? "border-destructive bg-destructive/10 hover:bg-destructive/15"
                : aiCost.overAlert
                  ? "border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/15"
                  : "border-border bg-card hover:bg-secondary"
            }`}>
            <div className="flex items-center gap-3">
              {aiCost.overAlert ? (
                <ShieldAlert className={`h-6 w-6 ${aiCost.overBudget ? "text-destructive" : "text-orange-500"}`} />
              ) : (
                <TrendingUp className="h-6 w-6 text-primary" />
              )}
              <div>
                <div className="font-semibold">
                  {aiCost.overBudget
                    ? `⚠️ Budget IA dépassé — ${aiCost.monthTotal.toFixed(2)} € / ${aiCost.budget} €`
                    : aiCost.overAlert
                      ? `⚠️ Alerte coût IA — ${aiCost.monthTotal.toFixed(2)} € (seuil ${aiCost.alertThreshold} €)`
                      : `Coût IA du mois : ${aiCost.monthTotal.toFixed(2)} € / ${aiCost.budget} €`}
                </div>
                <div className="text-sm text-muted-foreground">Ouvrir le tableau de bord admin</div>
              </div>
            </div>
            <span className="text-primary">→</span>
          </Link>
        )}

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Sessions à venir</h2>
            <Link to="/teachers" className="text-xs text-primary hover:underline">Réserver un autre créneau →</Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">Aucune session à venir.</div>
          ) : (
            <div className="mt-3 grid gap-2">
              {upcoming.map((b) => (
                <Link key={b.id} to="/live/$sessionId" params={{ sessionId: b.session!.id }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Video className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{b.session!.title ?? b.session!.subject}</div>
                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {new Date(b.session!.scheduled_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} · {b.session!.duration_min} min · {b.mode}
                    </div>
                  </div>
                  <span className="text-xs text-primary">→</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Mes cours</h2>
            <Link to="/courses" className="text-xs text-primary hover:underline">Découvrir plus →</Link>
          </div>
          {enrollments.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">Tu n'es inscrit à aucun cours.</div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {enrollments.map((e) => e.course && (
                <Link key={e.id} to="/courses/$courseId" params={{ courseId: e.course.id }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40">
                  <div className="grid h-12 w-16 place-items-center overflow-hidden rounded-lg bg-primary/10 text-primary">
                    {e.course.thumbnail_url ? <img src={e.course.thumbnail_url} alt="" className="h-full w-full object-cover" /> : <BookOpen className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold line-clamp-1">{e.course.title}</div>
                    <div className="text-xs text-muted-foreground">{e.course.subject}</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary" style={{ width: `${e.progress}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">Sessions passées</h2>
            <div className="mt-3 grid gap-2">
              {past.slice(0, 5).map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 p-3 text-sm">
                  <span>{b.session!.title ?? b.session!.subject}</span>
                  <span className="text-xs text-muted-foreground">{new Date(b.session!.scheduled_at).toLocaleDateString("fr-FR")}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}