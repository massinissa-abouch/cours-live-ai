import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BookOpenCheck, Sparkles, Send } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateAiExercise, gradeAiAnswer } from "@/lib/ai.functions";
import { pingStreak } from "@/lib/growth.functions";
import { ShareResultCard } from "@/components/ShareResultCard";

export const Route = createFileRoute("/_authenticated/tools/exercises")({
  component: ExercisesPage,
});

const SUBJECTS = [
  "Mathématiques", "Physique-Chimie", "Sciences naturelles", "Arabe",
  "Français", "Anglais", "Philosophie", "Histoire-Géographie", "Éducation islamique",
];

const LEVELS: Array<{ value: string; label: string }> = [
  { value: "cem_1", label: "1AM" }, { value: "cem_2", label: "2AM" },
  { value: "cem_3", label: "3AM" }, { value: "cem_4", label: "4AM (BEM)" },
  { value: "lycee_1_tc", label: "1AS Tronc commun" },
  { value: "lycee_2_sciences", label: "2AS Sciences" },
  { value: "lycee_2_lettres", label: "2AS Lettres" },
  { value: "lycee_2_maths", label: "2AS Maths" },
  { value: "lycee_3_sciences", label: "3AS Sciences (BAC)" },
  { value: "lycee_3_maths", label: "3AS Maths (BAC)" },
  { value: "lycee_3_lettres", label: "3AS Lettres (BAC)" },
  { value: "lycee_3_langues", label: "3AS Langues (BAC)" },
  { value: "lycee_3_gestion", label: "3AS Gestion (BAC)" },
  { value: "lycee_3_techmath", label: "3AS Tech. maths (BAC)" },
];

function ExercisesPage() {
  const { user } = Route.useRouteContext();
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [level, setLevel] = useState("lycee_3_sciences");
  const [chapter, setChapter] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [exercise, setExercise] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState<"idle" | "generating" | "grading">("idle");

  const generate = useServerFn(generateAiExercise);
  const grade = useServerFn(gradeAiAnswer);
  const ping = useServerFn(pingStreak);
  const [streakDays, setStreakDays] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("student_profiles").select("school_level").eq("user_id", user.id).maybeSingle();
      if (data?.school_level) setLevel(data.school_level);
    })();
  }, [user.id]);

  async function onGenerate() {
    setLoading("generating");
    setExercise(null); setFeedback(null); setAnswer("");
    try {
      const res = await generate({ data: { subject, level, chapter: chapter || undefined, difficulty } });
      setExercise(res.exercise);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading("idle");
    }
  }

  async function onGrade() {
    if (!exercise || !answer.trim()) return;
    setLoading("grading");
    try {
      const res = await grade({ data: { exerciseMarkdown: exercise, studentAnswer: answer } });
      setFeedback(res.feedback);
      try { const s = await ping(); setStreakDays(s.streakDays); } catch { /* ignore */ }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading("idle");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <Link to="/tools" className="rounded-lg p-2 hover:bg-secondary" aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <BookOpenCheck className="h-4 w-4 text-primary" />
          <div className="font-semibold">Banque d'exercices</div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Matière</span>
              <select value={subject} onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Niveau</span>
              <select value={level} onChange={(e) => setLevel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </label>
            <label className="md:col-span-2 block">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chapitre (optionnel)</span>
              <input value={chapter} onChange={(e) => setChapter(e.target.value)}
                placeholder="Ex : Suites numériques, Réactions acido-basiques…"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Difficulté : {difficulty}/5</span>
              <input type="range" min={1} max={5} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}
                className="mt-2 w-full accent-primary" />
            </label>
          </div>
          <button onClick={onGenerate} disabled={loading !== "idle"}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-90 disabled:opacity-60">
            <Sparkles className="h-4 w-4" />
            {loading === "generating" ? "Génération…" : "Générer un exercice"}
          </button>
        </div>

        {exercise && (
          <article className="mt-6 rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">Exercice</h2>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{exercise}</ReactMarkdown>
            </div>
          </article>
        )}

        {exercise && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ta réponse</span>
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={8}
                placeholder="Rédige ta solution étape par étape…"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <button onClick={onGrade} disabled={loading !== "idle" || !answer.trim()}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-soft)] hover:brightness-105 disabled:opacity-60">
              <Send className="h-4 w-4" />
              {loading === "grading" ? "Correction…" : "Corriger ma réponse"}
            </button>
          </div>
        )}

        {feedback && (
          <article className="mt-6 rounded-2xl border border-primary/40 bg-primary/5 p-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">Correction</h2>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{feedback}</ReactMarkdown>
            </div>
          </article>
        )}

        {feedback && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Partage ton progrès</h3>
            <ShareResultCard
              title={`Exercice ${subject} terminé`}
              score="✓"
              subtitle={chapter ? `Chapitre : ${chapter}` : `Niveau ${LEVELS.find((l) => l.value === level)?.label ?? level}`}
              streakDays={streakDays}
            />
          </div>
        )}
      </main>
    </div>
  );
}