import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/courses")({
  head: () => ({
    meta: [
      { title: "Cours — Ostadi" },
      { name: "description", content: "Catalogue de cours vidéo par des profs vérifiés, alignés sur le programme algérien." },
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
};

function Courses() {
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("courses")
        .select("id,title,subject,level,price,rating_avg,enrolled_count,thumbnail_url")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      const list = data ?? [];
      setCourses(list);
      // Signed URLs for thumbnails
      const entries = await Promise.all(
        list.filter((c) => c.thumbnail_url).map(async (c) => {
          const { data: sig } = await supabase.storage.from("course-media").createSignedUrl(c.thumbnail_url!, 3600);
          return [c.id, sig?.signedUrl ?? ""] as const;
        })
      );
      setThumbUrls(Object.fromEntries(entries));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      if (level !== "all" && c.level !== level) return false;
      if (q && !`${c.title} ${c.subject}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [courses, q, level]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 text-sm hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Accueil
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Catalogue de cours</h1>
        <p className="mt-2 text-muted-foreground">Cours vidéo par des profs vérifiés, alignés sur le programme algérien.</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un cours…"
            className="min-w-64 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <select value={level} onChange={(e) => setLevel(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="all">Tous niveaux</option>
            <option value="cem_4">4AM (BEM)</option>
            <option value="lycee_3_sciences">3AS Sciences</option>
            <option value="lycee_3_maths">3AS Maths</option>
            <option value="lycee_3_techmath">3AS Technique-Math</option>
            <option value="lycee_3_lettres">3AS Lettres</option>
            <option value="univ_1">L1 Université</option>
          </select>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4">
                <div className="aspect-video animate-pulse rounded-xl bg-secondary" />
                <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-secondary" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <p className="col-span-full text-sm text-muted-foreground">Aucun cours ne correspond.</p>
          ) : (
            filtered.map((c) => (
              <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }}
                className="group overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
                <div className="aspect-video overflow-hidden bg-secondary">
                  {thumbUrls[c.id] ? (
                    <img src={thumbUrls[c.id]} alt={c.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="grid h-full place-items-center text-4xl text-primary/40">📚</div>
                  )}
                </div>
                <div className="p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.subject}</div>
                  <h3 className="mt-1 font-semibold leading-snug">{c.title}</h3>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Star className="h-3.5 w-3.5 fill-current text-accent" /> {c.rating_avg.toFixed(1)}
                      <span className="text-xs">· {c.enrolled_count}</span>
                    </span>
                    <span className="font-semibold text-primary">{c.price} DZD</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}