import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, GraduationCap, School } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n/provider";

export const Route = createFileRoute("/library/")({
  head: () => ({
    meta: [
      { title: "Bibliothèque — Programme scolaire algérien | Ostadi" },
      { name: "description", content: "Explore le programme officiel algérien : primaire, CEM (BEM), lycée (BAC) et toutes les filières." },
    ],
  }),
  component: LibraryIndex,
});

const CYCLES = [
  { slug: "primaire", fr: "Primaire", ar: "الابتدائي", desc_fr: "1AP à 5AP", desc_ar: "من السنة الأولى إلى الخامسة", icon: School, color: "from-sky-500/25 to-emerald-500/10", accent: "text-sky-300" },
  { slug: "cem", fr: "Collège (CEM)", ar: "المتوسط", desc_fr: "1AM à 4AM · BEM", desc_ar: "من السنة الأولى إلى الرابعة · شهادة التعليم المتوسط", icon: BookOpen, color: "from-emerald-500/25 to-amber-500/10", accent: "text-emerald-300" },
  { slug: "lycee", fr: "Lycée", ar: "الثانوي", desc_fr: "1AS · 2AS · 3AS (BAC) — 6 filières", desc_ar: "الجذع المشترك والسنوات النهائية · الشعب الست", icon: GraduationCap, color: "from-amber-500/25 to-primary/10", accent: "text-amber-300" },
] as const;

function LibraryIndex() {
  const { lang } = useI18n();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const acc: Record<string, number> = {};
      for (const c of CYCLES) {
        const { count } = await supabase
          .from("edu_levels")
          .select("id", { count: "exact", head: true })
          .eq("cycle", c.slug);
        acc[c.slug] = count ?? 0;
      }
      setCounts(acc);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]" />
      <header className="relative z-10 border-b border-border/60 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {lang === "ar" ? "الرئيسية" : "Accueil"}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-14">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {lang === "ar" ? "المنهاج الرسمي الجزائري" : "Programme officiel algérien"}
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            {lang === "ar" ? "المكتبة الدراسية" : "La bibliothèque scolaire"}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {lang === "ar"
              ? "اختر الطور ثم السنة ثم المادة لاكتشاف الدروس والفصول والتمارين."
              : "Choisis le cycle, l'année, puis la matière pour accéder aux chapitres, leçons et exercices."}
          </p>
        </div>

        <section className="mt-10 grid gap-6 md:grid-cols-3">
          {CYCLES.map((c) => (
            <Link
              key={c.slug}
              to="/library/$cycle"
              params={{ cycle: c.slug }}
              className={`group relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br ${c.color} p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.35)]`}
            >
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-background/60 ${c.accent}`}>
                <c.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold">{lang === "ar" ? c.ar : c.fr}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{lang === "ar" ? c.desc_ar : c.desc_fr}</p>
              <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
                <span>{counts[c.slug] ?? "…"} {lang === "ar" ? "مستوى" : "niveaux"}</span>
                <span className="text-primary group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}