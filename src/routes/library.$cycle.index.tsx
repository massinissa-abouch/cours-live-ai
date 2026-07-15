import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n/provider";

const CYCLE_LABELS: Record<string, { fr: string; ar: string }> = {
  primaire: { fr: "Primaire", ar: "الابتدائي" },
  cem: { fr: "Collège (CEM)", ar: "المتوسط" },
  lycee: { fr: "Lycée", ar: "الثانوي" },
};

export const Route = createFileRoute("/library/$cycle")({
  head: ({ params }) => ({
    meta: [
      { title: `${CYCLE_LABELS[params.cycle]?.fr ?? "Cycle"} — Bibliothèque | Ostadi` },
      { name: "description", content: `Programme officiel algérien — cycle ${CYCLE_LABELS[params.cycle]?.fr ?? ""}.` },
    ],
  }),
  component: CycleLevels,
});

type Level = {
  id: string;
  cycle: string;
  grade: string;
  track: string | null;
  label_fr: string;
  label_ar: string;
  slug: string;
  order_index: number;
};

function CycleLevels() {
  const { cycle } = Route.useParams();
  const { lang } = useI18n();
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("edu_levels")
        .select("id,cycle,grade,track,label_fr,label_ar,slug,order_index")
        .eq("cycle", cycle)
        .order("order_index");
      setLevels((data ?? []) as Level[]);
      setLoading(false);
    })();
  }, [cycle]);

  if (!CYCLE_LABELS[cycle]) throw notFound();

  // For lycée we group by grade (1AS / 2AS / 3AS).
  const grouped = cycle === "lycee"
    ? Object.entries(levels.reduce<Record<string, Level[]>>((acc, l) => {
        (acc[l.grade] ??= []).push(l);
        return acc;
      }, {}))
    : [["", levels]] as [string, Level[]][];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_60%)]" />
      <header className="relative z-10 border-b border-border/60 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/library" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {lang === "ar" ? "المكتبة" : "Bibliothèque"}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-14">
        <div className="text-xs uppercase tracking-wider text-primary/80">
          {lang === "ar" ? "الطور" : "Cycle"}
        </div>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
          {lang === "ar" ? CYCLE_LABELS[cycle].ar : CYCLE_LABELS[cycle].fr}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {lang === "ar" ? "اختر السنة الدراسية." : "Choisis l'année scolaire."}
        </p>

        {loading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-3xl border border-border/60 bg-card/40" />
            ))}
          </div>
        ) : (
          <div className="mt-10 space-y-10">
            {grouped.map(([group, items]) => (
              <div key={group}>
                {group && (
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </h2>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((l) => (
                    <Link
                      key={l.id}
                      to="/library/$cycle/$levelSlug"
                      params={{ cycle, levelSlug: l.slug }}
                      className="group rounded-3xl border border-border/60 bg-card/40 p-5 backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card/70"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">
                        {l.track ? l.track.replace(/-/g, " ") : (lang === "ar" ? "السنة" : "Année")}
                      </div>
                      <div className="mt-2 text-lg font-semibold leading-snug group-hover:text-primary">
                        {lang === "ar" ? l.label_ar : l.label_fr}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}