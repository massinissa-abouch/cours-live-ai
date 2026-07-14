import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Brain, CheckCircle2, ChevronLeft, ChevronRight, Layers, Lightbulb, ListChecks, Loader2, Map, Repeat, Sparkles, Timer, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { getMemoSheet, simplifyBlock, markBlockProgress } from "@/lib/memo.functions";

export const Route = createFileRoute("/_authenticated/tools/memo/$sheetId")({
  component: MemoSheetPage,
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

type Sheet = Awaited<ReturnType<typeof getMemoSheet>>;
type Tab = "blocks" | "summary" | "mnemonics" | "timeline" | "mindmap" | "quiz";

function MemoSheetPage() {
  const { sheetId } = Route.useParams();
  const load = useServerFn(getMemoSheet);
  const simplify = useServerFn(simplifyBlock);
  const mark = useServerFn(markBlockProgress);

  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("blocks");
  const [current, setCurrent] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setSheet(await load({ data: { id: sheetId } })); } finally { setLoading(false); }
  }, [load, sheetId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const mastered = useMemo(() => new Set((sheet?.progress ?? []).filter((p) => p.mastered_at).map((p) => p.block_index)), [sheet]);

  if (loading || !sheet) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const blocks = sheet.blocks;
  const total = blocks.length;
  const progress = mastered.size;

  async function onSimplify(index: number) {
    setBusy(true);
    try {
      await simplify({ data: { id: sheetId, blockIndex: index } });
      toast.success("Version encore plus simple 🌱");
      void refresh();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function onQuizDone(score: number) {
    try {
      await mark({ data: { sheetId, blockIndex: current, quizScore: score } });
      toast.success(score >= 0.7 ? "Bloc validé ✅" : "À revoir bientôt 🔁");
      setShowQuiz(false);
      void refresh();
      if (current < total - 1) setCurrent(current + 1);
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2 px-4">
          <Link to="/tools/memo" className="rounded-lg p-2 hover:bg-secondary" aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] uppercase tracking-widest text-muted-foreground">
              {sheet.subject || "Fiche"} {sheet.level ? `· ${sheet.level}` : ""}
            </div>
            <div className="truncate text-base font-semibold">{sheet.title}</div>
          </div>
          <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {progress}/{total} blocs appris
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary transition-all" style={{ width: `${total ? (progress / total) * 100 : 0}%` }} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-4">
        <TabBar tab={tab} setTab={setTab} counts={{
          blocks: total,
          summary: sheet.formats.summary_bullets.length,
          mnemonics: sheet.formats.mnemonics.length,
          timeline: sheet.formats.timeline.length,
          mindmap: sheet.formats.mindmap.branches.length,
          quiz: sheet.formats.flashquiz.length,
        }} />

        <div className="mt-5">
          {tab === "blocks" && total > 0 && (
            <BlockCarousel
              block={blocks[current]}
              index={current}
              total={total}
              mastered={mastered.has(current)}
              onPrev={() => setCurrent((c) => Math.max(0, c - 1))}
              onNext={() => setCurrent((c) => Math.min(total - 1, c + 1))}
              onSimplify={() => onSimplify(current)}
              onQuiz={() => setShowQuiz(true)}
              busy={busy}
            />
          )}

          {tab === "summary" && (
            <Card icon={<ListChecks className="h-4 w-4" />} title="Les idées essentielles">
              <ul className="space-y-2 text-sm">
                {sheet.formats.summary_bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{b}</li>
                ))}
                {sheet.formats.summary_bullets.length === 0 && <EmptyHint>Pas de résumé généré.</EmptyHint>}
              </ul>
            </Card>
          )}

          {tab === "mnemonics" && (
            <Card icon={<Lightbulb className="h-4 w-4" />} title="Moyens mnémotechniques">
              {sheet.formats.mnemonics.length === 0 ? <EmptyHint>Aucun moyen mnémotechnique proposé.</EmptyHint> : (
                <div className="space-y-3">
                  {sheet.formats.mnemonics.map((m, i) => (
                    <div key={i} className="rounded-xl border border-border bg-background p-3">
                      {m.label && <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">{m.label}</div>}
                      <div className="mt-1 text-sm">{m.trick}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === "timeline" && (
            <Card icon={<Timer className="h-4 w-4" />} title="Frise chronologique">
              {sheet.formats.timeline.length === 0 ? <EmptyHint>Pas d'événements datés dans ce cours.</EmptyHint> : (
                <ol className="relative space-y-3 border-l-2 border-primary/30 pl-4">
                  {sheet.formats.timeline.map((e, i) => (
                    <li key={i}>
                      <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-primary" />
                      <div className="text-xs font-semibold text-primary">{e.date}</div>
                      <div className="text-sm">{e.event}</div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}

          {tab === "mindmap" && (
            <Card icon={<Map className="h-4 w-4" />} title="Carte mentale">
              {sheet.formats.mindmap.branches.length === 0 ? <EmptyHint>Pas de carte mentale pour ce cours.</EmptyHint> : (
                <div className="space-y-4">
                  <div className="mx-auto w-fit rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                    {sheet.formats.mindmap.center}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sheet.formats.mindmap.branches.map((br, i) => (
                      <div key={i} className="rounded-xl border border-border bg-background p-3">
                        <div className="text-sm font-semibold">{br.label}</div>
                        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                          {br.children.map((c, j) => <li key={j}>• {c}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {tab === "quiz" && (
            <QuizPanel questions={sheet.formats.flashquiz} />
          )}
        </div>
      </div>

      {showQuiz && (
        <QuickBlockQuiz
          block={blocks[current]}
          questions={sheet.formats.flashquiz}
          onCancel={() => setShowQuiz(false)}
          onDone={onQuizDone}
        />
      )}
    </div>
  );
}

// -------- UI atoms --------

function TabBar({ tab, setTab, counts }: { tab: Tab; setTab: (t: Tab) => void; counts: Record<Tab, number> }) {
  const items: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "blocks", label: "Blocs", icon: <Layers className="h-3.5 w-3.5" /> },
    { id: "summary", label: "Résumé", icon: <ListChecks className="h-3.5 w-3.5" /> },
    { id: "mnemonics", label: "Astuces", icon: <Lightbulb className="h-3.5 w-3.5" /> },
    { id: "timeline", label: "Frise", icon: <Timer className="h-3.5 w-3.5" /> },
    { id: "mindmap", label: "Carte", icon: <Map className="h-3.5 w-3.5" /> },
    { id: "quiz", label: "Quiz", icon: <Brain className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1 text-xs">
      {items.map((it) => (
        <button key={it.id} onClick={() => setTab(it.id)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium ${tab === it.id ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:bg-secondary"}`}>
          {it.icon} {it.label}
          {counts[it.id] > 0 && <span className={`rounded-full px-1.5 text-[10px] ${tab === it.id ? "bg-background/20" : "bg-secondary"}`}>{counts[it.id]}</span>}
        </button>
      ))}
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

// -------- Block carousel (flashcards) --------

function BlockCarousel({
  block, index, total, mastered, onPrev, onNext, onSimplify, onQuiz, busy,
}: {
  block: { title: string; key_points: string[] };
  index: number; total: number; mastered: boolean;
  onPrev: () => void; onNext: () => void; onSimplify: () => void; onQuiz: () => void; busy: boolean;
}) {
  return (
    <div>
      <div className="rounded-3xl border border-border bg-gradient-to-br from-card to-secondary/40 p-6 shadow-[var(--shadow-lift)]">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>Bloc {index + 1} / {total}</span>
          {mastered && <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Appris</span>}
        </div>
        <h2 className="mt-2 text-xl font-bold leading-tight">{block.title}</h2>
        <ul className="mt-4 space-y-3 text-[15px] leading-relaxed">
          {block.key_points.map((p, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button onClick={onQuiz}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow hover:opacity-90">
            <Brain className="h-4 w-4" /> Je me teste
          </button>
          <button onClick={onSimplify} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Encore plus simple
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button onClick={onPrev} disabled={index === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" /> Précédent
        </button>
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-1.5 bg-secondary"}`} />
          ))}
        </div>
        <button onClick={onNext} disabled={index === total - 1}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm disabled:opacity-40">
          Suivant <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// -------- Quick per-block quiz --------

type Q = { kind: "truefalse"; question: string; answer: boolean; explanation?: string }
       | { kind: "cloze"; question: string; answer: string; explanation?: string };

function pickQuizForBlock(block: { title: string; key_points: string[] }, all: Q[]): Q[] {
  if (all.length === 0) return [];
  const bag = [block.title, ...block.key_points].join(" ").toLowerCase();
  const scored = all.map((q) => ({ q, s: (bag.match(new RegExp(q.question.split(" ").slice(0, 3).join("|").toLowerCase(), "g")) || []).length }));
  scored.sort((a, b) => b.s - a.s);
  const picked = scored.slice(0, 3).map((x) => x.q);
  return picked.length ? picked : all.slice(0, Math.min(3, all.length));
}

function QuickBlockQuiz({
  block, questions, onCancel, onDone,
}: {
  block: { title: string; key_points: string[] };
  questions: Q[];
  onCancel: () => void;
  onDone: (score: number) => void;
}) {
  const list = useMemo(() => pickQuizForBlock(block, questions), [block, questions]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Array<{ correct: boolean }>>([]);
  const [reveal, setReveal] = useState<null | boolean>(null);
  const [input, setInput] = useState("");

  if (list.length === 0) {
    return (
      <Overlay onClose={onCancel}>
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Pas de questions pour ce bloc. Marque-le comme appris ?</p>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={onCancel} className="rounded-lg px-3 py-2 text-sm hover:bg-secondary">Annuler</button>
            <button onClick={() => onDone(1)} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Je le sais</button>
          </div>
        </div>
      </Overlay>
    );
  }

  const q = list[i];
  const done = answers.length === list.length;

  function submit(v: boolean | string) {
    const ok = q.kind === "truefalse"
      ? (v as boolean) === q.answer
      : String(v).trim().toLowerCase() === q.answer.trim().toLowerCase();
    setReveal(ok);
  }

  function next() {
    const ok = reveal === true;
    const nextAns = [...answers, { correct: ok }];
    setAnswers(nextAns);
    setReveal(null);
    setInput("");
    if (i + 1 < list.length) setI(i + 1);
  }

  return (
    <Overlay onClose={onCancel}>
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>Quiz — {block.title}</span>
          <span>{Math.min(i + 1, list.length)} / {list.length}</span>
        </div>
        {!done ? (
          <div>
            <div className="rounded-2xl border border-border bg-background p-4 text-[15px]">
              {q.question}
            </div>
            {q.kind === "truefalse" ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button disabled={reveal !== null} onClick={() => submit(true)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-60">Vrai</button>
                <button disabled={reveal !== null} onClick={() => submit(false)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-60">Faux</button>
              </div>
            ) : (
              <div className="mt-4 flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} disabled={reveal !== null}
                  placeholder="Ta réponse"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <button disabled={reveal !== null || !input.trim()} onClick={() => submit(input)}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">Vérifier</button>
              </div>
            )}
            {reveal !== null && (
              <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${reveal ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"}`}>
                <div className="font-semibold">{reveal ? "Bonne réponse !" : `Réponse : ${q.kind === "truefalse" ? (q.answer ? "Vrai" : "Faux") : q.answer}`}</div>
                {q.explanation && <div className="mt-1 opacity-90">{q.explanation}</div>}
                <div className="mt-3 flex justify-end">
                  <button onClick={next} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                    Suivant <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          (() => {
            const correct = answers.filter((a) => a.correct).length;
            const score = correct / list.length;
            return (
              <div className="py-3 text-center">
                <div className="text-4xl font-bold">{correct}/{list.length}</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {score >= 0.7 ? "Bloc maîtrisé ! On passe au suivant." : "Presque — on le revoit demain 🔁"}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <button onClick={onCancel} className="rounded-lg px-3 py-2 text-sm hover:bg-secondary">Fermer</button>
                  <button onClick={() => onDone(score)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                    <Repeat className="h-4 w-4" /> Enregistrer la progression
                  </button>
                </div>
              </div>
            );
          })()
        )}
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-card sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// -------- Whole-quiz panel --------

function QuizPanel({ questions }: { questions: Q[] }) {
  const [i, setI] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [input, setInput] = useState("");
  if (questions.length === 0) return <Card icon={<Brain className="h-4 w-4" />} title="Quiz flash"><EmptyHint>Aucune question flash générée.</EmptyHint></Card>;
  const q = questions[i];
  return (
    <Card icon={<Brain className="h-4 w-4" />} title={`Quiz flash · ${i + 1}/${questions.length}`}>
      <div className="rounded-xl border border-border bg-background p-3 text-sm">{q.question}</div>
      {!reveal ? (
        q.kind === "truefalse" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setReveal(true)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary">Vrai</button>
            <button onClick={() => setReveal(true)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary">Faux</button>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ta réponse"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <button onClick={() => setReveal(true)} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Voir</button>
          </div>
        )
      ) : (
        <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          <div className="font-semibold">Réponse : {q.kind === "truefalse" ? (q.answer ? "Vrai" : "Faux") : q.answer}</div>
          {q.explanation && <p className="mt-1 text-muted-foreground">{q.explanation}</p>}
        </div>
      )}
      <div className="mt-4 flex justify-between text-xs">
        <button disabled={i === 0} onClick={() => { setI(i - 1); setReveal(false); setInput(""); }}
          className="rounded-lg border border-border bg-card px-3 py-1.5 disabled:opacity-40">Précédent</button>
        <button disabled={i === questions.length - 1} onClick={() => { setI(i + 1); setReveal(false); setInput(""); }}
          className="rounded-lg border border-border bg-card px-3 py-1.5 disabled:opacity-40">Suivant</button>
      </div>
    </Card>
  );
}
