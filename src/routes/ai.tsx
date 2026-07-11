import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateAiExercise, gradeAiAnswer } from "@/lib/ai.functions";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "Entraînement IA — Ostadi" },
      { name: "description", content: "Génère des exercices alignés sur le programme algérien et fais-toi corriger par l'IA." },
    ],
  }),
  component: AI,
});

function AI() {
  const navigate = useNavigate();
  const generate = useServerFn(generateAiExercise);
  const grade = useServerFn(gradeAiAnswer);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [subject, setSubject] = useState("Mathématiques");
  const [level, setLevel] = useState("lycee_3_sciences");
  const [chapter, setChapter] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [sourceText, setSourceText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [exercise, setExercise] = useState<string>("");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string>("");
  const [loadingGen, setLoadingGen] = useState(false);
  const [loadingGrade, setLoadingGrade] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  function onImage(f: File | null) {
    if (!f) { setImageDataUrl(undefined); return; }
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoadingGen(true);
    setExercise(""); setFeedback(""); setAnswer("");
    try {
      const res = await generate({ data: { subject, level, chapter: chapter || undefined, difficulty, sourceText: sourceText || undefined, imageDataUrl } });
      setExercise(res.exercise);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur IA");
    } finally {
      setLoadingGen(false);
    }
  }

  async function onGrade() {
    if (!answer.trim()) return;
    setLoadingGrade(true);
    try {
      const res = await grade({ data: { exerciseMarkdown: exercise, studentAnswer: answer } });
      setFeedback(res.feedback);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur correction");
    } finally {
      setLoadingGrade(false);
    }
  }

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">Connecte-toi pour t'entraîner</h1>
          <p className="mt-2 text-sm text-muted-foreground">L'IA a besoin de savoir qui tu es pour suivre ta progression.</p>
          <button onClick={() => navigate({ to: "/auth" })}
            className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-4">
          <Link to="/" className="flex items-center gap-2 text-sm hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Accueil
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Entraînement IA</h1>
        <p className="mt-1 text-muted-foreground">Génère un exercice sur mesure, aligné sur ton chapitre.</p>

        <form onSubmit={onGenerate} className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold">Matière</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-semibold">Niveau</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <option value="cem_4">4AM (BEM)</option>
                <option value="lycee_3_sciences">3AS Sciences (BAC)</option>
                <option value="lycee_3_maths">3AS Maths (BAC)</option>
                <option value="lycee_3_techmath">3AS Technique-Math</option>
                <option value="lycee_3_lettres">3AS Lettres</option>
                <option value="univ_1">L1 Université</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold">Chapitre (optionnel)</label>
            <input value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="Ex: Fonctions numériques"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-semibold">Difficulté : {difficulty}</label>
            <input type="range" min={1} max={5} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-sm font-semibold">Sujet source (colle un énoncé) — optionnel</label>
            <textarea rows={3} value={sourceText} onChange={(e) => setSourceText(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-semibold">Ou photo du sujet — optionnel</label>
            <input type="file" accept="image/*" onChange={(e) => onImage(e.target.files?.[0] ?? null)}
              className="mt-1 block text-sm" />
          </div>
          <button type="submit" disabled={loadingGen}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-90 disabled:opacity-60">
            {loadingGen ? <><Loader2 className="h-4 w-4 animate-spin" /> Génération…</> : "Générer un exercice"}
          </button>
        </form>

        {exercise && (
          <section className="mt-8 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Ton exercice</h2>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">{exercise}</pre>
            <div className="mt-6">
              <label className="text-sm font-semibold">Ta réponse</label>
              <textarea rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <button onClick={onGrade} disabled={loadingGrade || !answer.trim()}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60">
                {loadingGrade ? <><Loader2 className="h-4 w-4 animate-spin" /> Correction…</> : "Corriger ma réponse"}
              </button>
            </div>
          </section>
        )}

        {feedback && (
          <section className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
            <h2 className="text-lg font-semibold text-primary">Correction</h2>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">{feedback}</pre>
          </section>
        )}
      </main>
    </div>
  );
}