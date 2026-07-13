import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageSquare, Plus, TrendingUp, Clock } from "lucide-react";
import { listThreads, createThread } from "@/lib/community.functions";

export const Route = createFileRoute("/_authenticated/community/")({
  component: CommunityIndex,
});

const SUBJECTS = ["Maths", "Physique", "Sciences naturelles", "Arabe", "Français", "Anglais", "Philosophie", "Histoire-Géographie", "Éducation islamique"];
const LEVELS = ["4AM", "BEM", "1AS", "2AS", "3AS", "BAC"];

type Data = Awaited<ReturnType<typeof listThreads>>;

function CommunityIndex() {
  const navigate = useNavigate();
  const load = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [state, setState] = useState<Data | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", subject: "", level: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setState(await load({ data: { subject: subject || undefined, level: level || undefined, sort } }));
    })();
  }, [subject, level, sort, load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const r = await create({ data: form });
      navigate({ to: "/community/$threadId", params: { threadId: r.id } });
    } catch (err) { setError((err as Error).message); }
    finally { setCreating(false); }
  }

  const profileMap = new Map((state?.profiles ?? []).map((p) => [p.id, p.full_name ?? "Élève"]));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <h1 className="ml-2 text-lg font-semibold">Communauté</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={subject} onChange={(e) => setSubject(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <option value="">Toutes matières</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={level} onChange={(e) => setLevel(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <option value="">Tous niveaux</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <div className="ml-auto flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setSort("recent")}
              className={`inline-flex items-center gap-1 px-3 py-2 text-xs ${sort === "recent" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
              <Clock className="h-3.5 w-3.5" /> Récents
            </button>
            <button onClick={() => setSort("popular")}
              className={`inline-flex items-center gap-1 px-3 py-2 text-xs ${sort === "popular" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
              <TrendingUp className="h-3.5 w-3.5" /> Populaires
            </button>
          </div>
          <button onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" /> Nouveau fil
          </button>
        </div>

        {showForm && (
          <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <input required placeholder="Titre du fil" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <select required value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="">Matière…</option>
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select required value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="">Niveau…</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <textarea required placeholder="Ta question ou ton message" value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[120px]" />
            {error && <div className="text-xs text-destructive">{error}</div>}
            <button disabled={creating} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {creating ? "Publication…" : "Publier"}
            </button>
          </form>
        )}

        <div className="space-y-2">
          {!state ? <div className="text-sm text-muted-foreground">Chargement…</div> :
           state.threads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground text-center">Aucun fil pour ce filtre. Sois le premier !</div>
          ) : state.threads.map((t) => (
            <Link key={t.id} to="/community/$threadId" params={{ threadId: t.id }}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold line-clamp-1">{t.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t.subject} · {t.level} · par {profileMap.get(t.author_id) ?? "Élève"} · {new Date(t.last_post_at).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <div className="text-xs text-muted-foreground shrink-0">💬 {t.posts_count}</div>
            </Link>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-4">
          Rappel : espace public. Sois respectueux. Signale tout contenu déplacé. Pas de messages privés — utilise les groupes de révision.
        </p>
      </main>
    </div>
  );
}