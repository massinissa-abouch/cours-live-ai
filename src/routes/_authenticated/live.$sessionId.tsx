import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Send, Loader2, StopCircle, CheckCircle2, XCircle, Users, Video } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import {
  getSessionDetail,
  sendLiveQuiz,
  closeLiveQuiz,
  answerLiveQuiz,
  endSessionAndSummarize,
} from "@/lib/live-session.functions";
import { getOrCreateDailyRoom } from "@/lib/daily.functions";

export const Route = createFileRoute("/_authenticated/live/$sessionId")({
  component: LiveRoom,
});

type Session = { id: string; title: string | null; subject: string; teacher_id: string; daily_room_url: string | null; status: string; scheduled_at: string; duration_min: number };
type Quiz = { id: string; question: string; options: string[]; correct_answer: string; sent_at: string; closed_at: string | null };
type Response = { quiz_id: string; student_id: string; answer: string; is_correct: boolean };
type Booking = { id: string; student_id: string; status: string; mode: string };

function LiveRoom() {
  const { sessionId } = Route.useParams();
  const load = useServerFn(getSessionDetail);
  const sendQ = useServerFn(sendLiveQuiz);
  const closeQ = useServerFn(closeLiveQuiz);
  const answerQ = useServerFn(answerLiveQuiz);
  const endSess = useServerFn(endSessionAndSummarize);
  const joinRoom = useServerFn(getOrCreateDailyRoom);

  const [session, setSession] = useState<Session | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [joining, setJoining] = useState(false);
  const [dailyUrl, setDailyUrl] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // teacher composer state
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correct, setCorrect] = useState(0);
  const [sending, setSending] = useState(false);
  // student answer state
  const [myAnswer, setMyAnswer] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function refresh() {
    const res = await load({ data: { id: sessionId } });
    setSession(res.session as Session);
    setIsTeacher(res.isTeacher);
    const { data: q } = await supabase
      .from("session_quizzes")
      .select("id,question,options,correct_answer,sent_at,closed_at")
      .eq("session_id", sessionId)
      .order("sent_at");
    setQuizzes((q ?? []) as unknown as Quiz[]);
    const ids = (q ?? []).map((x) => x.id);
    if (ids.length) {
      const { data: r } = await supabase
        .from("quiz_responses")
        .select("quiz_id,student_id,answer,is_correct")
        .in("quiz_id", ids);
      setResponses((r ?? []) as Response[]);
    }
    if (res.isTeacher) {
      const { data: b } = await supabase
        .from("session_bookings")
        .select("id,student_id,status,mode")
        .eq("session_id", sessionId);
      setBookings((b ?? []) as Booking[]);
    }
    const { data: sum } = await supabase
      .from("session_summaries")
      .select("summary_markdown")
      .eq("session_id", sessionId)
      .maybeSingle();
    setSummary(sum?.summary_markdown ?? null);
    if ((res.session as Session).daily_room_url) setDailyUrl((res.session as Session).daily_room_url);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    const channel = supabase
      .channel(`live-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_quizzes", filter: `session_id=eq.${sessionId}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_responses" }, (payload) => {
        const row = (payload.new ?? payload.old) as Response;
        if (!row) return;
        setResponses((prev) => {
          const others = prev.filter((r) => !(r.quiz_id === row.quiz_id && r.student_id === row.student_id));
          return payload.eventType === "DELETE" ? others : [...others, row];
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "session_bookings", filter: `session_id=eq.${sessionId}` }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const activeQuiz = useMemo(() => quizzes.find((q) => !q.closed_at) ?? null, [quizzes]);
  const activeQuizResponses = useMemo(() => (activeQuiz ? responses.filter((r) => r.quiz_id === activeQuiz.id) : []), [activeQuiz, responses]);
  const myResponse = useMemo(() => activeQuizResponses.find((r) => r.student_id === me), [activeQuizResponses, me]);

  async function onSendQuiz() {
    if (!question.trim() || options.some((o) => !o.trim()) || options.length < 2) {
      toast.error("Renseigne la question et au moins 2 options");
      return;
    }
    setSending(true);
    try {
      await sendQ({
        data: {
          sessionId,
          question,
          options,
          correctAnswer: options[correct],
        },
      });
      setQuestion("");
      setOptions(["", ""]);
      setCorrect(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSending(false);
    }
  }

  async function onAnswer(ans: string) {
    if (!activeQuiz || myResponse) return;
    setMyAnswer(ans);
    try {
      await answerQ({ data: { quizId: activeQuiz.id, answer: ans } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
      setMyAnswer("");
    }
  }

  async function onEndSession() {
    if (!confirm("Terminer la session et générer le résumé ?")) return;
    setEnding(true);
    try {
      const res = await endSess({ data: { sessionId } });
      setSummary(res.summary);
      toast.success("Session terminée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setEnding(false);
    }
  }

  if (!session) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const start = new Date(session.scheduled_at).getTime();
  const openAt = start - 15 * 60 * 1000;
  const closeAt = start + (session.duration_min + 30) * 60 * 1000;
  const canJoin = now >= openAt && now <= closeAt;
  const minsUntilOpen = Math.max(0, Math.ceil((openAt - now) / 60_000));

  async function handleJoin() {
    setJoining(true);
    try {
      const res = await joinRoom({ data: { sessionId } });
      setDailyUrl(res.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="text-sm font-semibold">{session.title ?? session.subject}</div>
              <div className="text-[11px] text-muted-foreground">Session {isTeacher ? "prof" : "élève"} · statut {session.status}</div>
            </div>
          </div>
          {isTeacher && !summary && (
            <button
              onClick={onEndSession}
              disabled={ending}
              className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50">
              {ending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StopCircle className="h-3.5 w-3.5" />} Terminer & résumer
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_400px]">
        <section className="space-y-4">
          <div className="aspect-video overflow-hidden rounded-2xl border border-border bg-black">
            {dailyUrl ? (
              <iframe src={dailyUrl} title="Visio" allow="camera; microphone; fullscreen; display-capture" className="h-full w-full" />
            ) : (
              <div className="grid h-full place-items-center p-6 text-center text-white/70">
                <div>
                  <Video className="mx-auto h-10 w-10 opacity-80" />
                  <div className="mt-3 text-sm">
                    {canJoin
                      ? "La salle est prête. Clique pour rejoindre."
                      : `Ouverture dans ${minsUntilOpen} min (15 min avant le début).`}
                  </div>
                  <button
                    onClick={handleJoin}
                    disabled={!canJoin || joining}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                    Rejoindre la visio
                  </button>
                </div>
              </div>
            )}
          </div>

          {summary && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <div className="mb-3 text-sm font-semibold text-primary">Résumé automatique de la session</div>
              <article className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </article>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          {isTeacher ? (
            <>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Quiz express</div>
                  {activeQuiz && (
                    <button onClick={() => closeQ({ data: { quizId: activeQuiz.id } })}
                      className="text-[11px] font-semibold text-destructive">Clôturer</button>
                  )}
                </div>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Question à envoyer aux élèves…"
                  rows={2}
                  className="mt-3 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
                <div className="mt-3 space-y-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct"
                        checked={correct === i}
                        onChange={() => setCorrect(i)}
                        className="accent-primary"
                        title="Marquer comme bonne réponse"
                      />
                      <input
                        value={opt}
                        onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                      />
                      {options.length > 2 && (
                        <button onClick={() => setOptions(options.filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-destructive">
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {options.length < 6 && (
                    <button onClick={() => setOptions([...options, ""])}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                      <Plus className="h-3.5 w-3.5" /> Ajouter une option
                    </button>
                  )}
                </div>
                <button
                  onClick={onSendQuiz}
                  disabled={sending}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {activeQuiz ? "Envoyer le suivant (clôture le courant)" : "Envoyer le quiz"}
                </button>
              </div>

              {activeQuiz && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="text-xs text-muted-foreground">Quiz en cours</div>
                  <div className="mt-1 font-semibold">{activeQuiz.question}</div>
                  <div className="mt-3 space-y-1 text-xs">
                    {bookings.length === 0 && <div className="text-muted-foreground">Aucun élève inscrit.</div>}
                    {bookings.map((b) => {
                      const resp = activeQuizResponses.find((r) => r.student_id === b.student_id);
                      return (
                        <div key={b.student_id} className="flex items-center justify-between rounded-lg bg-secondary/40 px-2 py-1.5">
                          <span className="font-mono text-[10px]">Élève {b.student_id.slice(0, 8)}</span>
                          {resp ? (
                            <span className={`inline-flex items-center gap-1 ${resp.is_correct ? "text-primary" : "text-destructive"}`}>
                              {resp.is_correct ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                              {resp.answer}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">…en attente</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {bookings.length} participant{bookings.length > 1 ? "s" : ""}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-4">
              {!activeQuiz && (
                <div className="text-sm text-muted-foreground">En attente du prochain quiz du prof…</div>
              )}
              {activeQuiz && (
                <>
                  <div className="text-xs text-muted-foreground">Question en cours</div>
                  <div className="mt-1 font-semibold">{activeQuiz.question}</div>
                  <div className="mt-3 space-y-2">
                    {activeQuiz.options.map((opt) => {
                      const chosen = myResponse?.answer === opt || myAnswer === opt;
                      const done = !!myResponse;
                      return (
                        <button
                          key={opt}
                          disabled={done}
                          onClick={() => onAnswer(opt)}
                          className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                            chosen ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                          } disabled:cursor-not-allowed disabled:opacity-70`}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {myResponse && (
                    <div className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${myResponse.is_correct ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                      {myResponse.is_correct ? "✓ Bonne réponse !" : "✗ Pas cette fois — attends le prochain."}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historique quiz</div>
            <div className="mt-2 space-y-1 text-xs">
              {quizzes.length === 0 && <div className="text-muted-foreground">Aucun quiz envoyé.</div>}
              {quizzes.filter((q) => q.closed_at).map((q) => {
                const rs = responses.filter((r) => r.quiz_id === q.id);
                const ok = rs.filter((r) => r.is_correct).length;
                return (
                  <div key={q.id} className="rounded-lg bg-secondary/40 px-2 py-1.5">
                    <div className="line-clamp-1">{q.question}</div>
                    <div className="text-[10px] text-muted-foreground">{ok}/{rs.length} corrects</div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
