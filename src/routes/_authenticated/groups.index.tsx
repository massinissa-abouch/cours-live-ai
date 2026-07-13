import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Users, Plus, LogIn, Copy, Check } from "lucide-react";
import { listMyGroups, createGroup, joinGroupByCode } from "@/lib/groups.functions";

export const Route = createFileRoute("/_authenticated/groups/")({
  component: GroupsIndex,
});

type Group = Awaited<ReturnType<typeof listMyGroups>>[number];

function GroupsIndex() {
  const navigate = useNavigate();
  const load = useServerFn(listMyGroups);
  const create = useServerFn(createGroup);
  const join = useServerFn(joinGroupByCode);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", subject: "", level: "", description: "", maxMembers: 20 });
  const [code, setCode] = useState("");

  useEffect(() => {
    (async () => {
      setGroups(await load());
      setLoading(false);
    })();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const g = await create({ data: form });
      navigate({ to: "/groups/$groupId", params: { groupId: g.id } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setJoining(true);
    try {
      const g = await join({ data: { code } });
      navigate({ to: "/groups/$groupId", params: { groupId: g.id } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <h1 className="ml-2 text-lg font-semibold">Groupes de révision</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Mes groupes</h2>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">Chargement…</div>
          ) : groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Aucun groupe. Crée-en un ou rejoins-en un via son code.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map((g) => (
                <Link
                  key={g.id}
                  to="/groups/$groupId"
                  params={{ groupId: g.id }}
                  className="rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{g.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {g.subject} · {g.level}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(g.invite_code); setCopied(g.id); setTimeout(() => setCopied(null), 1500); }}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] font-mono hover:bg-secondary/80"
                      title="Copier le code d'invitation"
                    >
                      {copied === g.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {g.invite_code}
                    </button>
                  </div>
                  {g.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{g.description}</p>}
                  <div className="mt-3 text-xs text-muted-foreground">
                    {g.memberCount} / {g.max_members} membres {g.role === "owner" && "· 👑 admin"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <form onSubmit={onCreate} className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Créer un groupe</h3>
            </div>
            <input required placeholder="Nom du groupe" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input required placeholder="Matière" value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input required placeholder="Niveau (ex. 3AS)" value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <textarea placeholder="Description (optionnel)" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[60px]" />
            <button disabled={creating} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {creating ? "Création…" : "Créer le groupe"}
            </button>
          </form>

          <form onSubmit={onJoin} className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Rejoindre avec un code</h3>
            </div>
            <input required placeholder="Code d'invitation" value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono uppercase tracking-widest" />
            <p className="text-xs text-muted-foreground">Demande son code à un camarade déjà dans le groupe.</p>
            <button disabled={joining} className="w-full rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50">
              {joining ? "…" : "Rejoindre"}
            </button>
          </form>
        </div>

        {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      </main>
    </div>
  );
}