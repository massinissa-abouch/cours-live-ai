import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { ChapterAiSheet } from "@/components/ChapterAiSheet";

export const Route = createFileRoute("/library/$cycle/$levelSlug/$subjectSlug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.subjectSlug} — Chapitres | Ostadi` },
      { name: "description", content: "Chapitres officiels du programme algérien." },
    ],
  }),
  component: SubjectChapters,
});

type Subject = { id: string; name_fr: string; name_ar: string; icon: string | null; color: string | null; level: { label_fr: string; label_ar: string } | null };
type Chapter = { id: string; title_fr: string; title_ar: string; summary_fr: string | null; summary_ar: string | null; order_index: number };

function SubjectChapters() {
  const { cycle, levelSlug, subjectSlug } = Route.useParams();
  const { lang } = useI18n();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);

  useEffect(() => {
    (async () => {
      const { data: lvl } = await supabase.from("edu_levels").select("id,label_fr,label_ar").eq("slug", levelSlug).maybeSingle();
      if (!lvl) { setMissing(true); setLoading(false); return; }
      const { data: sub } = await supabase
        .from("edu_subjects")
        .select("id,name_fr,name_ar,icon,color")
        .eq("slug", subjectSlug)
        .eq("level_id", lvl.id)
        .maybeSingle();
      if (!sub) { setMissing(true); setLoading(false); return; }
      setSubject({ ...(sub as Omit<Subject, "level">), level: { label_fr: lvl.label_fr, label_ar: lvl.label_ar } });
      const { data: chaps } = await supabase
        .from("edu_chapters")
        .select("id,title_fr,title_ar,summary_fr,summary_ar,order_index")
        .eq("subject_id", sub.id)
        .order("order_index");
      setChapters((chaps ?? []) as Chapter[]);
      setLoading(false);
    })();
  }, [levelSlug, subjectSlug]);

  if (missing) throw notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_60%)]" />
      <header className="relative z-10 border-b border-border/60 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-4 px-4">
          <Link
            to="/library/$cycle/$levelSlug"
            params={{ cycle, levelSlug }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {lang === "ar" ? "المواد" : "Matières"}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-4 pb-20 pt-14">
        <div className="flex items-start gap-5">
          {subject && (
            <div
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-3xl"
              style={{ background: (subject.color ?? "#10B981") + "22", color: subject.color ?? "#10B981" }}
            >
              <span>{subject.icon ?? "📘"}</span>
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-primary/80">
              {subject?.level && (lang === "ar" ? subject.level.label_ar : subject.level.label_fr)}
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              {subject && (lang === "ar" ? subject.name_ar : subject.name_fr)}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {lang === "ar" ? "قائمة الفصول الرسمية." : "Chapitres officiels du programme."}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-border/60 bg-card/40" />
            ))}
          </div>
        ) : chapters.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-border/60 bg-card/30 p-14 text-center">
            <div className="text-4xl">🧭</div>
            <p className="mt-3 text-sm text-muted-foreground">
              {lang === "ar"
                ? "لم تُضف الفصول بعد لهذه المادة."
                : "Les chapitres seront ajoutés très bientôt pour cette matière."}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {lang === "ar" ? "قيد الإعداد" : "En préparation"}
            </div>
          </div>
        ) : (
          <ol className="mt-10 space-y-3">
            {chapters.map((c, i) => (
              <li
                key={c.id}
                className="group flex items-start gap-4 rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur transition hover:border-primary/50 hover:bg-card/70"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-snug group-hover:text-primary">
                    {lang === "ar" ? c.title_ar : c.title_fr}
                  </div>
                  {(lang === "ar" ? c.summary_ar : c.summary_fr) && (
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {lang === "ar" ? c.summary_ar : c.summary_fr}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-primary/40 text-primary hover:bg-primary/10"
                  onClick={() => setActiveChapter(c)}
                >
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {lang === "ar" ? "اشرح لي بالذكاء" : "Explique-moi avec l'IA"}
                  </span>
                  <span className="sm:hidden">{lang === "ar" ? "اشرح" : "IA"}</span>
                </Button>
              </li>
            ))}
          </ol>
        )}
      </main>

      {activeChapter && subject && (
        <ChapterAiSheet
          chapterId={activeChapter.id}
          chapterTitle={lang === "ar" ? activeChapter.title_ar : activeChapter.title_fr}
          subjectName={lang === "ar" ? subject.name_ar : subject.name_fr}
          levelLabel={
            subject.level ? (lang === "ar" ? subject.level.label_ar : subject.level.label_fr) : ""
          }
          open={!!activeChapter}
          onOpenChange={(v) => !v && setActiveChapter(null)}
        />
      )}
    </div>
  );
}