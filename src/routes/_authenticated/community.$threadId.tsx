import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Heart, Flag, Send, Trash2 } from "lucide-react";
import {
  getThread, createPost, togglePostLike, reportContent,
  deleteOwnThread, deleteOwnPost,
} from "@/lib/community.functions";

export const Route = createFileRoute("/_authenticated/community/$threadId")({
  component: ThreadView,
});

type Data = Awaited<ReturnType<typeof getThread>>;

function ThreadView() {
  const { threadId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const load = useServerFn(getThread);
  const post = useServerFn(createPost);
  const like = useServerFn(togglePostLike);
  const report = useServerFn(reportContent);
  const delThread = useServerFn(deleteOwnThread);
  const delPost = useServerFn(deleteOwnPost);

  const [state, setState] = useState<Data | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [liked, setLiked] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const d = await load({ data: { id: threadId } });
      setState(d);
      setLiked(new Set(d.likedPostIds));
    })();
  }, [threadId, load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await post({ data: { threadId, body: text.trim() } });
      setText("");
      const d = await load({ data: { id: threadId } });
      setState(d);
      setLiked(new Set(d.likedPostIds));
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function onLike(postId: string) {
    const wasLiked = liked.has(postId);
    setLiked((s) => { const n = new Set(s); wasLiked ? n.delete(postId) : n.add(postId); return n; });
    setState((s) => s && ({
      ...s,
      posts: s.posts.map((p) => p.id === postId ? { ...p, likes_count: p.likes_count + (wasLiked ? -1 : 1) } : p),
    }));
    try { await like({ data: { postId } }); } catch { /* revert on error skipped */ }
  }

  async function onReport(targetType: "thread" | "post", targetId: string) {
    const reason = prompt("Raison du signalement :");
    if (!reason || reason.trim().length < 3) return;
    try {
      await report({ data: { targetType, targetId, reason: reason.trim() } });
      alert("Signalement envoyé. Merci.");
    } catch (err) { alert((err as Error).message); }
  }

  if (!state) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;
  const profileMap = new Map(state.profiles.map((p) => [p.id, p]));
  const isThreadOwner = state.thread.author_id === user.id;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <Link to="/community" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{state.thread.title}</div>
            <div className="text-xs text-muted-foreground">{state.thread.subject} · {state.thread.level}</div>
          </div>
          {isThreadOwner && (
            <button onClick={async () => { if (confirm("Supprimer ce fil ?")) { await delThread({ data: { id: threadId } }); navigate({ to: "/community" }); } }}
              className="rounded-md p-2 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => onReport("thread", threadId)}
            className="rounded-md p-2 text-muted-foreground hover:bg-secondary">
            <Flag className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">
            {profileMap.get(state.thread.author_id)?.full_name ?? "Élève"} · {new Date(state.thread.created_at).toLocaleString("fr-FR")}
          </div>
          <div className="whitespace-pre-wrap text-sm">{state.thread.body}</div>
        </div>

        {state.posts.length > 0 && <div className="text-xs font-semibold text-muted-foreground uppercase pt-2">{state.posts.length} réponse{state.posts.length > 1 ? "s" : ""}</div>}

        {state.posts.map((p) => {
          const mine = p.author_id === user.id;
          return (
            <div key={p.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-xs text-muted-foreground">
                  {profileMap.get(p.author_id)?.full_name ?? "Élève"} · {new Date(p.created_at).toLocaleString("fr-FR")}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => onLike(p.id)}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${liked.has(p.id) ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-secondary"}`}>
                    <Heart className={`h-3.5 w-3.5 ${liked.has(p.id) ? "fill-current" : ""}`} /> {p.likes_count}
                  </button>
                  {mine ? (
                    <button onClick={async () => { if (confirm("Supprimer ?")) { await delPost({ data: { id: p.id } }); setState((s) => s && ({ ...s, posts: s.posts.filter((x) => x.id !== p.id) })); } }}
                      className="rounded-md p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  ) : (
                    <button onClick={() => onReport("post", p.id)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><Flag className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              </div>
              <div className="whitespace-pre-wrap text-sm">{p.body}</div>
            </div>
          );
        })}

        <form onSubmit={submit} className="sticky bottom-2 mt-4 rounded-2xl border border-border bg-card p-3 space-y-2">
          <textarea required value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Ta réponse…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[70px]" />
          {error && <div className="text-xs text-destructive">{error}</div>}
          <button disabled={busy || !text.trim()} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            <Send className="h-4 w-4" /> Répondre
          </button>
        </form>
      </main>
    </div>
  );
}