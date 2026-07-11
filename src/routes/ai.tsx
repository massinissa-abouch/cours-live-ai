import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Sparkles, Loader2, Send, MessageCircle, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateAiExercise, gradeAiAnswer } from "@/lib/ai.functions";
import { chatWithTutor } from "@/lib/ai-chat.functions";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "Ostadi IA — Tuteur & Exercices" },
      { name: "description", content: "Discute avec ton tuteur IA et génère des exercices alignés sur le programme algérien." },
    ],
  }),
  component: AI,
});

type ChatMsg = { role: "user" | "assistant"; content: string };

function AI() {
  const navigate = useNavigate();
  const generate = useServerFn(generateAiExercise);
  const grade = useServerFn(gradeAiAnswer);
  const chat = useServerFn(chatWithTutor);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"chat" | "exercise">("chat");

  // shared context
  const [subject, setSubject] = useState("Mathématiques");
  const [level, setLevel] = useState("lycee_3_sciences");

  // chat state
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Salut 👋 Je suis Ostadi, ton tuteur IA. Pose-moi une question sur ton cours, un exercice ou un chapitre difficile — je t'explique pas à pas." },
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // exercise state
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chatLoading]);

  function onImage(f: File | null) {
    if (!f) { setImageDataUrl(undefined); return; }
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || chatLoading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setChatLoading(true);
    try {
      const res = await chat({ data: { messages: next, subject, level } });
      setMessages([...next, { role: "assistant", content: res.reply }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur IA");
    } finally {
      setChatLoading(false);
    }
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
          <h1 className="mt-4 text-2xl font-bold">Connecte-toi pour discuter avec l'IA</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ostadi IA a besoin de savoir qui tu es pour suivre ta progression.</p>
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
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4">
          <Link to="/" className="flex items-center gap-2 text-sm hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Accueil
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/30">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ostadi IA</h1>
            <p className="text-sm text-muted-foreground">Discute avec ton tuteur ou génère un exercice sur mesure.</p>
          </div>
        </div>

        <div className="mt-6 inline-flex rounded-xl border border-border bg-card p-1">
          <button onClick={() => setTab("chat")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === "chat" ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]" : "text-muted-foreground hover:text-foreground"}`}>
            <MessageCircle className="h-4 w-4" /> Discussion
          </button>
          <button onClick={() => setTab("exercise")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === "exercise" ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]" : "text-muted-foreground hover:text-foreground"}`}>
            <Wand2 className="h-4 w-4" /> Exercice
          </button>
        </div>

        <div className="mt-4 grid gap-3 rounded-xl border border-border/60 bg-card/60 p-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Matière (contexte)</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Niveau</label>
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

        {tab === "chat" && (
          <section className="mt-6 flex h-[68vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-lift)]">
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}>
                    <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="inline h-4 w-4 animate-spin" /> Ostadi réfléchit…
                  </div>
                </div>
              )}
            </div>
            <form onSubmit={onSend} className="flex items-end gap-2 border-t border-border bg-background/40 p-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(e); } }}
                rows={1}
                placeholder="Pose ta question… (Entrée pour envoyer, Shift+Entrée = nouvelle ligne)"
                className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
              <button type="submit" disabled={chatLoading || !input.trim()}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </section>
        )}

        {tab === "exercise" && (
          <>
            <form onSubmit={onGenerate} className="mt-6 grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div>
                <label className="text-sm font-semibold">Chapitre (optionnel)</label>
                <input value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="Ex: Fonctions numériques"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-semibold">Difficulté : {difficulty}</label>
                <input type="range" min={1} max={5} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} className="mt-1 w-full accent-primary" />
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
              <section className="mt-6 rounded-2xl border border-border bg-card p-5">
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
              <section className="mt-6 rounded-2xl border border-primary/30 bg-primary/10 p-5">
                <h2 className="text-lg font-semibold text-primary">Correction</h2>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">{feedback}</pre>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}