import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n/provider";

export const Route = createFileRoute("/library/$cycle/$levelSlug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.levelSlug} — Matières | Ostadi` },
      { name: "description", content: "Matières officielles du programme algérien." },
    ],
  }),
  component: LevelSubjects,
});

type Level = { id: string; label_fr: string; label_ar: string; grade: string; track: string | null };
type Subject = { id: string; name_fr: string; name_ar: string; slug: string; icon: string | null; color: string | null; order_index: number };

function LevelSubjects() {
  const { cycle, levelSlug } = Route.useParams();
  const { lang } = useI18n();
  const [level, setLevel] = useState<Level | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: lvl } = await supabase
        .from("edu_levels")
        .select("id,label_fr,label_ar,grade,track")
        .eq("slug", levelSlug)
        .maybeSingle();
      if (!lvl) { setMissing(true); setLoading(false); return; }
      setLevel(lvl as Level);
      const { data: subs } = await supabase
        .from("edu_subjects")
        .select("id,name_fr,name_ar,slug,icon,color,order_index")
        .eq("level_id", lvl.id)
        .order("order_index");
      setSubjects((subs ?? []) as Subject[]);
      setLoading(false);
    })();
  }, [levelSlug]);

  if (missing) throw notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_60%)]" />
      <header className="relative z-10 border-b border-border/60 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/library/$cycle" params={{ cycle }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {lang === "ar" ? "رجوع" : "Retour"}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-14">
        <div className="text-xs uppercase tracking-wider text-primary/80">
          {lang === "ar" ? "المادة" : "Matières"}
        </div>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
          {level && (lang === "ar" ? level.label_ar : level.label_fr)}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {lang === "ar" ? "اختر المادة لبدء المراجعة." : "Choisis une matière pour commencer la révision."}
        </p>

        {loading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-3xl border border-border/60 bg-card/40" />
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-border/60 bg-card/30 p-14 text-center">
            <div className="text-4xl">📚</div>
            <p className="mt-3 text-sm text-muted-foreground">
              {lang === "ar" ? "لا توجد مواد بعد." : "Aucune matière pour ce niveau pour l'instant."}
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s) => (
              <Link
                key={s.id}
                to="/library/$cycle/$levelSlug/$subjectSlug"
                params={{ cycle, levelSlug, subjectSlug: s.slug }}
                className="group flex items-start gap-4 rounded-3xl border border-border/60 bg-card/40 p-5 backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card/70"
              >
                <div
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl"
                  style={{ background: (s.color ?? "#10B981") + "22", color: s.color ?? "#10B981" }}
                >
                  <span>{s.icon ?? "📘"}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold leading-snug group-hover:text-primary">
                    {lang === "ar" ? s.name_ar : s.name_fr}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {lang === "ar" ? s.name_fr : s.name_ar}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}