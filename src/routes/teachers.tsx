import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Star, GraduationCap, Clock, Search, MapPin } from "lucide-react";

export const Route = createFileRoute("/teachers")({
  head: () => ({
    meta: [
      { title: "Profs en direct — Ostadi" },
      { name: "description", content: "Trouve un prof algérien disponible pour une session en tête-à-tête ou en petit groupe." },
    ],
  }),
  component: Teachers,
});

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

type Slot = { day_of_week: number; start_time: string; end_time: string };
type Teacher = {
  user_id: string;
  bio: string | null;
  subjects: string[];
  hourly_rate: number | null;
  rating_avg: number;
  total_students: number;
  verification_status: string;
  profile: { full_name: string | null; avatar_url: string | null; wilaya: string | null } | null;
  slots: Slot[];
};

function fmtTime(t: string) {
  return t.slice(0, 5);
}

function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [dayFilter, setDayFilter] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data: profs } = await supabase
        .from("teacher_profiles")
        .select("user_id, bio, subjects, hourly_rate, rating_avg, total_students, verification_status")
        .order("rating_avg", { ascending: false });

      const ids = (profs ?? []).map((p) => p.user_id);
      if (ids.length === 0) { setTeachers([]); setLoading(false); return; }

      const [{ data: profiles }, { data: slots }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url, wilaya").in("id", ids),
        supabase.from("teacher_availability").select("teacher_id, day_of_week, start_time, end_time").in("teacher_id", ids),
      ]);

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const slotMap = new Map<string, Slot[]>();
      (slots ?? []).forEach((s) => {
        const arr = slotMap.get(s.teacher_id) ?? [];
        arr.push({ day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time });
        slotMap.set(s.teacher_id, arr);
      });

      setTeachers(
        (profs ?? []).map((p) => ({
          ...p,
          profile: profileMap.get(p.user_id) ? {
            full_name: profileMap.get(p.user_id)!.full_name,
            avatar_url: profileMap.get(p.user_id)!.avatar_url,
            wilaya: profileMap.get(p.user_id)!.wilaya,
          } : null,
          slots: (slotMap.get(p.user_id) ?? []).sort(
            (a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)
          ),
        }))
      );
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return teachers.filter((t) => {
      const hay = `${t.profile?.full_name ?? ""} ${t.subjects.join(" ")} ${t.bio ?? ""}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (dayFilter !== null && !t.slots.some((s) => s.day_of_week === dayFilter)) return false;
      return true;
    });
  }, [teachers, q, dayFilter]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Link to="/" className="flex items-center gap-2 text-sm hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Accueil
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Profs disponibles en direct</h1>
        <p className="mt-2 text-muted-foreground">Filtre par matière ou par jour de disponibilité et réserve un créneau.</p>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Chercher un prof, une matière…"
              className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setDayFilter(null)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${dayFilter === null ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              Tous
            </button>
            {DAYS.map((d, i) => (
              <button key={d} onClick={() => setDayFilter(i)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${dayFilter === i ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : filtered.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center">
              <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {teachers.length === 0 ? "Aucun prof inscrit pour l'instant." : "Aucun prof ne correspond à ta recherche."}
              </p>
            </div>
          ) : (
            filtered.map((t) => (
              <article key={t.user_id} className="group rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
                <div className="flex items-start gap-4">
                  {t.profile?.avatar_url ? (
                    <img src={t.profile.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-primary/30" />
                  ) : (
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-lg font-bold text-primary ring-2 ring-primary/30">
                      {(t.profile?.full_name ?? "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-semibold">{t.profile?.full_name ?? "Prof"}</h3>
                      {t.verification_status === "verified" && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">✓ vérifié</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-accent text-accent" /> {t.rating_avg.toFixed(1)}</span>
                      <span>{t.total_students} élèves</span>
                      {t.profile?.wilaya && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {t.profile.wilaya}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">{t.hourly_rate ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">DZD/h</div>
                  </div>
                </div>

                {t.bio && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{t.bio}</p>}

                {t.subjects.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.subjects.slice(0, 4).map((s) => (
                      <span key={s} className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{s}</span>
                    ))}
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-border/60 bg-background/40 p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Créneaux hebdo
                  </div>
                  {t.slots.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucun créneau publié — contacte le prof.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {t.slots.slice(0, 6).map((s, i) => (
                        <span key={i} className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {DAYS[s.day_of_week]} · {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                        </span>
                      ))}
                      {t.slots.length > 6 && <span className="text-[11px] text-muted-foreground">+{t.slots.length - 6}</span>}
                    </div>
                  )}
                </div>

                <button
                  className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                  onClick={() => alert("La réservation arrive très bientôt ⏳")}
                >
                  Réserver un créneau
                </button>
              </article>
            ))
          )}
        </div>
      </main>
    </div>
  );
}