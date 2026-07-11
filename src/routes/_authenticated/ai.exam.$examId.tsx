import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Clock, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { getExam, submitExam } from "@/lib/ai-revision.functions";

export const Route = createFileRoute("/_authenticated/ai/exam/")({
  component: ExamPage,
});

type Question = { id: string; question: string; kind: "open" | "mcq"; options?: string[] };
type Grading = { score: number; items: Array<{ id: string; score: number; comment: string; correction: string }> };

function ExamPage() {
  const { examId } = Route.useParams();
  const load = useServerFn(getExam);
  const submit = useServerFn(submitExam);
  const [exam, setExam] = useState<{ questions: Question[]; duration_min: number; grading: Grading | null; score: number | null; finished_at: string | null; subject: string; chapter: string | null } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [grading, setGrading] = useState<Grading | null>(null);

  useEffect(() => {
    load({ data: { id: examId } }).then((row) => {
      setExam({
        questions: row.questions as unknown as Question[],
        duration_min: row.duration_min,
        grading: (row.grading as unknown as Grading) ?? null,
        score: row.score as number | null,
        finished_at: row.finished_at,
        subject: row.subject,
        chapter: row.chapter,
      });
      setSecondsLeft(row.duration_min * 60);
      if (row.grading) setGrading(row.grading as unknown as Grading);
      if (row.answers) setAnswers(row.answers as unknown as Record<string, string>);
    }).catch((e) => toast.error(e instanceof Error ? e.message : "Erreur"));
  }, [examId, load]);

  useEffect(() => {
    if (!exam || grading || exam.finished_at) return;
    if (secondsLeft <= 0) {
      handleSubmit();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, exam, grading]);

  const q = useMemo(() => exam?.questions[currentIdx], [exam, currentIdx]);

  async function handleSubmit() {
    if (!exam || submitting) return;
    setSubmitting(true);
    try {
      const g = await submit({ data: { id: examId, answers } });
      setGrading(g);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  if (!exam) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (grading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <div className="mt-3 text-sm text-muted-foreground">Contrôle terminé</div>
          <div className="mt-1 text-5xl font-bold text-primary">{grading.score}<span className="text-2xl text-muted-foreground">/20</span></div>
          <div className="mt-1 text-xs text-muted-foreground">{exam.subject} · {exam.chapter ?? ""}</div>
        </div>
        <div className="mt-6 space-y-4">
          {exam.questions.map((qq, i) => {
            const g = grading.items.find((x) => x.id === qq.id);
            return (
              <div key={qq.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Question {i + 1}</div>
                    <div className="mt-1 font-medium">{qq.question}</div>
                  </div>
                  <div className="text-right text-sm font-semibold">
                    {g?.score ?? 0}/3
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">Ta réponse :</div>
                <div className="mt-1 rounded-lg bg-secondary/60 px-3 py-2 text-sm">{answers[qq.id] || <span className="text-muted-foreground">(vide)</span>}</div>
                {g && (
                  <div className="mt-3 space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                    <div><span className="font-semibold text-primary">Commentaire : </span>{g.comment}</div>
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{`**Correction :** ${g.correction}`}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const ss = (secondsLeft % 60).toString().padStart(2, "0");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-b-2xl border border-border bg-background/80 px-4 py-3 backdrop-blur">
        <div className="text-xs text-muted-foreground">
          Question <span className="font-semibold text-foreground">{currentIdx + 1}</span> / {exam.questions.length}
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
          <Clock className="h-3.5 w-3.5" /> {mm}:{ss}
        </div>
      </div>

      {q && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <div className="text-lg font-medium leading-relaxed">{q.question}</div>
          {q.kind === "mcq" && q.options ? (
            <div className="mt-4 space-y-2">
              {q.options.map((opt) => (
                <label key={opt} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${answers[q.id] === opt ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === opt}
                    onChange={() => setAnswers({ ...answers, [q.id]: opt })}
                    className="mt-1 accent-primary"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              rows={6}
              placeholder="Écris ta réponse ici…"
              className="mt-4 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          )}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx((i) => i - 1)}
          className="rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-40">
          ← Précédent
        </button>
        {currentIdx < exam.questions.length - 1 ? (
          <button
            onClick={() => setCurrentIdx((i) => i + 1)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Suivant →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Correction…</> : "Terminer et corriger"}
          </button>
        )}
      </div>
    </div>
  );
}
