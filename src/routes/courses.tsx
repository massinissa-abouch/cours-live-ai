import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Sparkles, TrendingUp, Star, Users, Zap, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/courses")({
  head: () => ({
    meta: [
      { title: "Marketplace de cours — Ostadi" },
      { name: "description", content: "Explore un catalogue premium de cours vidéo par des profs vérifiés, alignés sur le programme algérien." },
    ],
  }),
  component: Courses,
});

type CourseCard = {
  id: string;
  title: string;
  subject: string;
  level: string;
  price: number;
  rating_avg: number;
  enrolled_count: number;
  thumbnail_url: string | null;
  created_at: string;
};

const LEVELS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Tous niveaux" },
  { value: "cem_4", label: "4AM · BEM" },
  { value: "lycee_3_sciences", label: "3AS Sciences" },
  { value: "lycee_3_maths", label: "3AS Maths" },
  { value: "lycee_3_techmath", label: "3AS Tech-Math" },
  { value: "lycee_3_lettres", label: "3AS Lettres" },
  { value: "univ_1", label: "L1 Université" },
];

const SORTS: Array<{ value: string; label: string }> = [
  { value: "new", label: "Nouveautés" },
  { value: "popular", label: "Populaires" },
  { value: "rating", label: "Mieux notés" },
  { value: "price_asc", label: "Prix ↑" },
  { value: "price_desc", label: "Prix ↓" },
];

function Courses() {
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<string>("all");
  const [subject, setSubject] = useState<string>("all");
  const [sort, setSort] = useState<string>("new");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("courses")
        .select("id,title,subject,level,price,rating_avg,enrolled_count,thumbnail_url,created_at")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      const list = data ?? [];
      setCourses(list);
      const entries = await Promise.all(
        list.filter((c) => c.thumbnail_url).map(async (c) => {
          const { data: sig } = await supabase.storage.from("course-media").createSignedUrl(c.thumbnail_url!, 3600);
          return [c.id, sig?.signedUrl ?? ""] as const;
        }),
      );
      setThumbUrls(Object.fromEntries(entries));
      setLoading(false);
    })();
  }, []);

  const subjects = useMemo(() => {
    const s = new Set<string>();
    courses.forEach((c) => s.add(c.subject));
    return ["all", ...Array.from(s).sort()];
  }, [courses]);

  const filtered = useMemo(() => {
    const list = courses.filter((c) => {
      if (level !== "all" && c.level !== level) return false;
      if (subject !== "all" && c.subject !== subject) return false;
      if (q && !`${c.title} ${c.subject}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    const sorted = [...list];
    switch (sort) {
      case "popular": sorted.sort((a, b) => b.enrolled_count - a.enrolled_count); break;
      case "rating": sorted.sort((a, b) => b.rating_avg - a.rating_avg); break;
      case "price_asc": sorted.sort((a, b) => a.price - b.price); break;
      case "price_desc": sorted.sort((a, b) => b.price - a.price); break;
      default: sorted.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    }
    return sorted;
  }, [courses, q, level, subject, sort]);

  const topBadgeIds = useMemo(() => {
    const best = [...courses].sort((a, b) => b.enrolled_count - a.enrolled_count)[0]?.id;
    return { best };
  }, [courses]);

  const isNew = (iso: string) => Date.now() - new Date(iso).getTime() < 1000 * 60 * 60 * 24 * 14;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]" />

      <header className="relative z-10 border-b border-border/60 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Accueil
          </Link>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Marketplace
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-16">
        {/* Hero */}
        <section className="pt-14 pb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Nouveaux cours ajoutés chaque semaine
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Le marketplace des <span className="bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">meilleurs profs</span> d'Algérie
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Cours vidéo premium, aligné 100 % sur le programme officiel. Chapitres clairs, exercices, quiz IA — tu progresses vraiment.
          </p>

          {/* Search bar */}
          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-3 backdrop-blur-xl md:flex-row md:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-background/50 px-3 py-2 ring-1 ring-inset ring-border/50 focus-within:ring-primary/60">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un cours, une matière, un prof…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-lg border border-border/60 bg-background/70 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/60"
              >
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Chip filters */}
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLevel(l.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    level === l.value
                      ? "border-primary/60 bg-primary/15 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
                      : "border-border/60 bg-card/40 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >{l.label}</button>
              ))}
            </div>
            {subjects.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide transition ${
                      subject === s
                        ? "border-accent/60 bg-accent/15 text-accent-foreground"
                        : "border-border/40 bg-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >{s === "all" ? "Toutes matières" : s}</button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Grid */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-3">
                <div className="aspect-video animate-pulse rounded-2xl bg-secondary/60" />
                <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-secondary/60" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-secondary/40" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-dashed border-border/60 bg-card/30 p-14 text-center">
              <div className="text-4xl">🔎</div>
              <p className="mt-3 text-sm text-muted-foreground">Aucun cours ne correspond à ta recherche.</p>
            </div>
          ) : (
            filtered.map((c) => {
              const badge = c.id === topBadgeIds.best && c.enrolled_count > 0
                ? { label: "Best-seller", icon: TrendingUp, cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" }
                : isNew(c.created_at)
                ? { label: "Nouveau", icon: Zap, cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" }
                : null;

              return (
                <Link
                  key={c.id}
                  to="/courses/$courseId"
                  params={{ courseId: c.id }}
                  className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-3 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:bg-card/70 hover:shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.35)]"
                >
                  <div className="relative aspect-video overflow-hidden rounded-2xl bg-secondary/60">
                    {thumbUrls[c.id] ? (
                      <img
                        src={thumbUrls[c.id]}
                        alt={c.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-5xl text-primary/30">📚</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                    {badge && (
                      <div className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold backdrop-blur ${badge.cls}`}>
                        <badge.icon className="h-3 w-3" /> {badge.label}
                      </div>
                    )}
                    <div className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/50 px-2 py-1 text-[10px] font-medium text-white backdrop-blur">
                      {c.level.replace(/_/g, " ")}
                    </div>
                  </div>
                  <div className="px-2 pt-4 pb-3">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-primary/80">{c.subject}</div>
                    <h3 className="mt-1 line-clamp-2 font-semibold leading-snug transition group-hover:text-primary">
                      {c.title}
                    </h3>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {c.rating_avg.toFixed(1)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {c.enrolled_count}
                        </span>
                      </div>
                      <div className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary">
                        {c.price} <span className="text-[10px] font-medium">DZD</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}