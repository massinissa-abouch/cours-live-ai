import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { createExam } from "@/lib/ai-revision.functions";

export const Route = createFileRoute("/_authenticated/ai/exam/new")({
  component: NewExam,
});

function NewExam() {
  const navigate = useNavigate();
  const create = useServerFn(createExam);
  const [subject, setSubject] = useState("Mathématiques");
  const [level, setLevel] = useState("lycee_3_sciences");
  const [chapter, setChapter] = useState("");
  const [durationMin, setDurationMin] = useState(20);
  const [questionCount, setQuestionCount] = useState(6);
  const [difficulty, setDifficulty] = useState(3);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await create({
        data: { subject, level, chapter: chapter || undefined, durationMin, questionCount, difficulty },
      });
      navigate({ to: "/ai/exam/$examId", params: { examId: res.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/20 text-accent">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Prépare-moi un contrôle</h1>
          <p className="text-sm text-muted-foreground">
            L'IA génère un mini-examen chronométré aligné sur le programme algérien.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Matière">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label="Niveau">
            <select value={level} onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="cem_4">4AM (BEM)</option>
              <option value="lycee_1_tc">1AS Tronc commun</option>
              <option value="lycee_2_sciences">2AS Sciences</option>
              <option value="lycee_3_sciences">3AS Sciences</option>
              <option value="lycee_3_maths">3AS Maths</option>
              <option value="lycee_3_techmath">3AS Technique-Math</option>
              <option value="lycee_3_lettres">3AS Lettres</option>
              <option value="univ_1">L1 Université</option>
            </select>
          </Field>
        </div>
        <Field label="Chapitre">
          <input value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="Ex : Fonctions du second degré"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={`Durée : ${durationMin} min`}>
            <input type="range" min={5} max={60} step={5} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className="w-full accent-primary" />
          </Field>
          <Field label={`Questions : ${questionCount}`}>
            <input type="range" min={3} max={12} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className="w-full accent-primary" />
          </Field>
          <Field label={`Difficulté : ${difficulty}/5`}>
            <input type="range" min={1} max={5} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} className="w-full accent-primary" />
          </Field>
        </div>
        <button type="submit" disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] disabled:opacity-60">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Génération…</> : "Démarrer le contrôle"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
