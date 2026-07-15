import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, Loader2, CheckCircle2, XCircle, ChevronDown, Wand2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  getChapterAi,
  generateChapterAi,
  completeChapter,
} from "@/lib/library-ai.functions";

type Exercise = { question: string; correction: string };
type ChapterAi = { explanation: string; exercises: Exercise[]; eli5?: string };

type Verdict = "ok" | "ko" | null;

export function ChapterAiSheet({
  chapterId,
  chapterTitle,
  subjectName,
  levelLabel,
  open,
  onOpenChange,
}: {
  chapterId: string;
  chapterTitle: string;
  subjectName: string;
  levelLabel: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const fetchAi = useServerFn(getChapterAi);
  const genAi = useServerFn(generateChapterAi);
  const markDone = useServerFn(completeChapter);

  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<ChapterAi | null>(null);
  const [showEli5, setShowEli5] = useState(false);
  const [verdicts, setVerdicts] = useState<Verdict[]>([null, null, null]);
  const [openExo, setOpenExo] = useState<Record<number, boolean>>({});
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowEli5(false);
    setVerdicts([null, null, null]);
    setOpenExo({});
    setCompleted(false);
    setLoading(true);
    fetchAi({ data: { chapterId } })
      .then((r) => setContent(r.content))
      .catch((e) => toast.error(e?.message ?? "Erreur"))
      .finally(() => setLoading(false));
  }, [open, chapterId, fetchAi]);

  async function generate(eli5 = false) {
    setLoading(true);
    try {
      const r = await genAi({ data: { chapterId, eli5 } });
      setContent(r.content);
      if (eli5) setShowEli5(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const failCount = verdicts.filter((v) => v === "ko").length;
  const attemptedCount = verdicts.filter((v) => v !== null).length;

  async function finish() {
    try {
      const r = await markDone({ data: { chapterId } });
      setCompleted(true);
      if (!r.alreadyCompleted) toast.success("Chapitre validé ! +XP 🎉");
      else toast.info("Chapitre déjà validé");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-2xl"
      >
        <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 px-5 py-4 backdrop-blur-xl">
          <SheetHeader className="text-left">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Ostadi IA
            </div>
            <SheetTitle className="mt-1 text-xl leading-snug">{chapterTitle}</SheetTitle>
            <SheetDescription className="text-xs">
              {subjectName} · {levelLabel}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="space-y-6 px-5 py-6">
          {loading && !content && (
            <div className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {!loading && !content && (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-6 text-center">
              <div className="text-3xl">✨</div>
              <p className="mt-2 text-sm text-muted-foreground">
                L'IA n'a pas encore expliqué ce chapitre. Lance la génération.
              </p>
              <Button className="mt-4" onClick={() => generate(false)}>
                <Wand2 className="mr-2 h-4 w-4" /> Générer l'explication
              </Button>
            </div>
          )}

          {content && (
            <>
              <section className="rounded-2xl border border-border/60 bg-card/40 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-primary">
                    {showEli5 && content.eli5 ? "Explication simplifiée" : "Explication"}
                  </h3>
                  {content.eli5 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowEli5((v) => !v)}
                    >
                      {showEli5 ? "Version normale" : "Version simplifiée"}
                    </Button>
                  )}
                </div>
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {showEli5 && content.eli5 ? content.eli5 : content.explanation}
                  </ReactMarkdown>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-primary">Exercices ({content.exercises.length})</h3>
                {content.exercises.map((exo, i) => (
                  <div key={i} className="rounded-2xl border border-border/60 bg-card/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-muted-foreground">
                          Exercice {i + 1}
                        </div>
                        <div className="prose prose-sm prose-invert mt-1 max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{exo.question}</ReactMarkdown>
                        </div>
                      </div>
                    </div>

                    <Collapsible
                      open={openExo[i] ?? false}
                      onOpenChange={(o) => setOpenExo((s) => ({ ...s, [i]: o }))}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="mt-2 -ml-2">
                          <ChevronDown
                            className={`mr-1 h-4 w-4 transition-transform ${
                              openExo[i] ? "rotate-180" : ""
                            }`}
                          />
                          Voir la correction
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 rounded-xl border border-border/40 bg-background/60 p-3">
                        <div className="prose prose-sm prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{exo.correction}</ReactMarkdown>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Tu as réussi ?</span>
                          <Button
                            size="sm"
                            variant={verdicts[i] === "ok" ? "default" : "outline"}
                            onClick={() =>
                              setVerdicts((v) => v.map((x, idx) => (idx === i ? "ok" : x)))
                            }
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Oui
                          </Button>
                          <Button
                            size="sm"
                            variant={verdicts[i] === "ko" ? "destructive" : "outline"}
                            onClick={() =>
                              setVerdicts((v) => v.map((x, idx) => (idx === i ? "ko" : x)))
                            }
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" /> Non
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                ))}
              </section>

              {failCount >= 2 && !showEli5 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="text-sm">
                    Ces exercices étaient durs. Veux-tu une explication plus simple ?
                  </p>
                  <Button
                    className="mt-3"
                    size="sm"
                    onClick={() => generate(true)}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4" />
                    )}
                    Réexplique-moi plus simplement
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generate(false)}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  Régénérer
                </Button>
                <Button
                  onClick={finish}
                  disabled={completed || attemptedCount === 0}
                >
                  {completed ? "Validé ✓" : "Marquer terminé"}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}