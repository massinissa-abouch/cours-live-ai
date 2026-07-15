import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Video, Sparkles, GraduationCap, Bell, Clock, ShieldAlert, TrendingUp, Wrench, Archive, Flame, Gift, Users, MessageSquare, ListChecks, ArrowRight } from "lucide-react";
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

  const now = Date.now();
  const upcoming = bookings
    .filter((b) => b.session && new Date(b.session.scheduled_at).getTime() >= now - 30 * 60_000)
    .sort((a, b) => new Date(a.session!.scheduled_at).getTime() - new Date(b.session!.scheduled_at).getTime());
  const past = bookings
    .filter((b) => b.session && new Date(b.session.scheduled_at).getTime() < now - 30 * 60_000);
  const unread = notifs.filter((n) => !n.read_at).length;

  const quickActions = [
    { icon: Sparkles, title: "Tuteur IA", desc: "Explique-moi un chapitre, corrige-moi", to: "/ai" as const, tone: "primary" as const },
    { icon: ListChecks, title: "Cahier de textes", desc: "Photo → planning IA", to: "/tools/homework" as const, tone: "accent" as const },
    { icon: Archive, title: "Archive BAC & BEM", desc: "Annales & corrigés officiels", to: "/archive" as const, tone: "neutral" as const },
    { icon: BookOpen, title: "Mes cours", desc: "Reprendre là où tu t'es arrêté", to: "/courses" as const, tone: "neutral" as const },
    { icon: Video, title: "Réserver un prof", desc: "Session live 1-à-1", to: "/teachers" as const, tone: "neutral" as const },
    { icon: Users, title: "Groupes d'étude", desc: "Réviser en équipe", to: "/groups" as const, tone: "neutral" as const },
    { icon: MessageSquare, title: "Communauté", desc: "Pose une question", to: "/community" as const, tone: "neutral" as const },
    { icon: Wrench, title: "Outils", desc: "Calculateur, compte à rebours…", to: "/tools" as const, tone: "neutral" as const },
  ];

  return (
    <div className="min-h-full">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60 bg-hero">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,oklch(1_0_0/0.06)_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary/80">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            <span>Programme algérien officiel</span>
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Bonjour <span className="bg-emerald-gradient bg-clip-text text-transparent">{user.user_metadata?.full_name?.split(" ")[0] ?? "élève"}</span>.
          </h1>
          <p className="mt-3 max-w-xl text-base text-muted-foreground">
            Prêt à progresser aujourd'hui ? Ton tuteur IA, tes cours et tes profs sont là.
          </p>

          {growth && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <StatPill icon={<Flame className="h-3.5 w-3.5" />} tone="amber">
                {growth.streakDays > 0 ? `${growth.streakDays} jour${growth.streakDays > 1 ? "s" : ""} d'affilée` : "Démarre ton streak"}
              </StatPill>
              {growth.perkActive && (
                <StatPill icon={<Sparkles className="h-3.5 w-3.5" />} tone="emerald">
                  Accès illimité actif
                </StatPill>
              )}
              <StatPill icon={<Bell className="h-3.5 w-3.5" />} tone="neutral">
                {unread} notif{unread > 1 ? "s" : ""} non lue{unread > 1 ? "s" : ""}
              </StatPill>
              <Link to="/invite" className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15">
                <Gift className="h-3.5 w-3.5" /> Invite 3 amis → +7 jours ({growth.acceptedCount}/3)
              </Link>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
        {/* Bento quick actions */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(140px,1fr)]">
          {quickActions.map((c, i) => {
            const isFeature = c.tone === "primary";
            const isAccent = c.tone === "accent";
            return (
              <Link
                key={c.title}
                to={c.to}
                style={{ animationDelay: `${i * 40}ms` }}
                className={`group animate-fade-in relative overflow-hidden rounded-3xl border p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] ${
                  isFeature
                    ? "border-primary/30 bg-primary/10 sm:col-span-2 lg:row-span-2 shadow-glow"
                    : isAccent
                      ? "border-accent/30 bg-accent/10 lg:col-span-2"
                      : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className={`mb-4 grid h-11 w-11 place-items-center rounded-2xl transition-transform group-hover:scale-110 ${
                  isFeature ? "bg-emerald-gradient text-primary-foreground shadow-glow" :
                  isAccent ? "bg-amber-gradient text-accent-foreground" :
                  "bg-secondary text-primary"
                }`}>
                  <c.icon className={isFeature ? "h-6 w-6" : "h-5 w-5"} />
                </div>
                <h3 className={`font-display font-bold tracking-tight ${isFeature ? "text-2xl" : "text-base"}`}>
                  {c.title}
                </h3>
                <p className={`mt-1 text-muted-foreground ${isFeature ? "text-sm" : "text-xs"}`}>{c.desc}</p>
                <ArrowRight className="absolute right-5 top-5 h-4 w-4 text-muted-foreground/50 opacity-0 transition-all group-hover:right-4 group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>

        {isTeacher && (
          <Link to="/teacher"
            className="mt-6 flex items-center justify-between rounded-3xl border border-primary/30 bg-primary/5 p-5 transition hover:bg-primary/10">
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
            className={`mt-6 flex items-center justify-between rounded-3xl border p-5 transition ${
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

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <SectionHeader title="Sessions à venir" cta="Réserver un créneau" to="/teachers" />
            {upcoming.length === 0 ? (
              <EmptyCard>Aucune session à venir. Réserve un prof pour continuer.</EmptyCard>
            ) : (
              <div className="mt-4 grid gap-2">
                {upcoming.map((b) => (
                  <Link key={b.id} to="/live/$sessionId" params={{ sessionId: b.session!.id }}
                    className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-card/80">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Video className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{b.session!.title ?? b.session!.subject}</div>
                      <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {new Date(b.session!.scheduled_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} · {b.session!.duration_min} min
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader title="Mes cours" cta="Explorer" to="/courses" />
            {enrollments.length === 0 ? (
              <EmptyCard>Aucun cours en cours. Explore le catalogue.</EmptyCard>
            ) : (
              <div className="mt-4 space-y-2">
                {enrollments.slice(0, 4).map((e) => e.course && (
                  <Link key={e.id} to="/courses/$courseId" params={{ courseId: e.course.id }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-primary/40">
                    <div className="grid h-11 w-14 place-items-center overflow-hidden rounded-lg bg-primary/10 text-primary">
                      {e.course.thumbnail_url ? <img src={e.course.thumbnail_url} alt="" className="h-full w-full object-cover" /> : <BookOpen className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{e.course.title}</div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full bg-emerald-gradient transition-all" style={{ width: `${e.progress}%` }} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {notifs.length > 0 && (
          <section className="mt-12">
            <SectionHeader title="Dernières notifications" />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {notifs.slice(0, 6).map((n) => (
                <Link key={n.id} to={n.link ?? "/dashboard"}
                  onClick={() => !n.read_at && markRead({ data: { id: n.id } })}
                  className="rounded-2xl border border-border bg-card p-3 transition hover:border-primary/40">
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{n.title}</div>
                      {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                      <div className="mt-1 text-[10px] text-muted-foreground/70">{new Date(n.created_at).toLocaleString("fr-FR")}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section className="mt-12">
            <SectionHeader title="Sessions passées" />
            <div className="mt-4 grid gap-2">
              {past.slice(0, 5).map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-3 text-sm">
                  <span>{b.session!.title ?? b.session!.subject}</span>
                  <span className="text-xs text-muted-foreground">{new Date(b.session!.scheduled_at).toLocaleDateString("fr-FR")}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StatPill({ icon, tone, children }: { icon: React.ReactNode; tone: "emerald" | "amber" | "neutral"; children: React.ReactNode }) {
  const cls =
    tone === "emerald"
      ? "border-primary/40 bg-primary/10 text-primary"
      : tone === "amber"
        ? "border-accent/40 bg-accent/10 text-accent"
        : "border-border bg-card/60 text-muted-foreground";
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${cls}`}>
      {icon}{children}
    </div>
  );
}

function SectionHeader({ title, cta, to }: { title: string; cta?: string; to?: "/teachers" | "/courses" }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      {cta && to && (
        <Link to={to} className="text-xs font-medium text-primary hover:underline">{cta} →</Link>
      )}
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}