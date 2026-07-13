import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Bell, BellOff, Camera, CheckCircle2, Clock, Flame, Loader2,
  Play, Plus, Sparkles, Trash2, X, AlarmClock, Zap, ListChecks, Users, Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  analyzeTaskSource, createTask, listMyTasks, updateTask, deleteTask, savePushSubscription,
} from "@/lib/tasks.functions";
import { listMyGroups } from "@/lib/groups.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tools/homework")({
  component: HomeworkPage,
});

type Task = Awaited<ReturnType<typeof listMyTasks>>[number];
type Group = Awaited<ReturnType<typeof listMyGroups>>[number];

function urgencyBucket(t: Task): { label: string; color: string; ring: string; sort: number } {
  if (t.status === "done") return { label: "Terminé", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", ring: "border-emerald-500/30", sort: 4 };
  if (!t.due_at) return { label: "Sans date", color: "bg-muted text-muted-foreground", ring: "border-border", sort: 3 };
  const h = (new Date(t.due_at).getTime() - Date.now()) / 3_600_000;
  if (h <= 0) return { label: "En retard", color: "bg-red-500/15 text-red-600 dark:text-red-400", ring: "border-red-500/40", sort: 0 };
  if (h <= 24) return { label: "Aujourd'hui", color: "bg-orange-500/15 text-orange-600 dark:text-orange-400", ring: "border-orange-500/40", sort: 1 };
  if (h <= 72) return { label: "Cette semaine", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", ring: "border-amber-500/30", sort: 2 };
  return { label: "À venir", color: "bg-primary/10 text-primary", ring: "border-primary/20", sort: 3 };
}

function formatDue(due?: string | null) {
  if (!due) return "Sans échéance";
  const d = new Date(due);
  const diffH = (d.getTime() - Date.now()) / 3_600_000;
  const rel = diffH <= 0
    ? `${Math.ceil(-diffH)} h de retard`
    : diffH < 24 ? `dans ${Math.round(diffH)} h` : `dans ${Math.round(diffH / 24)} j`;
  return `${d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" })} · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} — ${rel}`;
}

function HomeworkPage() {
  const load = useServerFn(listMyTasks);
  const patch = useServerFn(updateTask);
  const del = useServerFn(deleteTask);
  const loadGroups = useServerFn(listMyGroups);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [pushState, setPushState] = useState<"unknown" | "granted" | "denied" | "unsupported">("unknown");
  const [focus, setFocus] = useState<Task | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setTasks(await load({ data: { status: filter === "done" ? "done" : filter === "all" ? "all" : "open" } })); }
    finally { setLoading(false); }
  }, [load, filter]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { loadGroups().then(setGroups).catch(() => {}); }, [loadGroups]);

  // Realtime : rafraîchit à chaque changement de tâche
  useEffect(() => {
    const ch = supabase.channel("student_tasks_self")
      .on("postgres_changes", { event: "*", schema: "public", table: "student_tasks" }, () => void refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  // Statut notifications navigateur
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) { setPushState("unsupported"); return; }
    setPushState(Notification.permission === "granted" ? "granted" : Notification.permission === "denied" ? "denied" : "unknown");
  }, []);

  // Notifs navigateur locales : quand une nouvelle notification arrive, l'afficher
  useEffect(() => {
    if (typeof window === "undefined" || Notification.permission !== "granted") return;
    const ch = supabase.channel("notifications_self_push")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        const row = payload.new as { title?: string; body?: string; type?: string };
        if (!row?.title) return;
        try {
          const n = new Notification(row.title, { body: row.body ?? "", icon: "/favicon.ico", tag: row.type ?? "ostadi" });
          n.onclick = () => window.focus();
        } catch { /* ignore */ }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pushState]);

  async function enablePush() {
    if (!("Notification" in window)) { toast.error("Navigateur non supporté"); return; }
    const perm = await Notification.requestPermission();
    setPushState(perm === "granted" ? "granted" : perm === "denied" ? "denied" : "unknown");
    if (perm === "granted") {
      toast.success("Rappels navigateur activés ✅");
      try { new Notification("Ostadi", { body: "Rappels activés. On veille sur tes échéances." }); } catch {}
    }
  }

  async function toggleDone(t: Task) {
    const next = t.status === "done" ? "todo" : "done";
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x));
    try { await patch({ data: { id: t.id, patch: { status: next } } }); }
    catch (e) { toast.error((e as Error).message); void refresh(); }
  }

  async function snooze(t: Task, hours: number) {
    const base = t.due_at ? new Date(t.due_at) : new Date();
    const next = new Date(Math.max(base.getTime(), Date.now()) + hours * 3_600_000).toISOString();
    await patch({ data: { id: t.id, patch: { due_at: next } } });
    toast.success(`Reporté de ${hours}h`);
    void refresh();
  }

  async function remove(t: Task) {
    if (!confirm("Supprimer cet exercice ?")) return;
    await del({ data: { id: t.id } });
    void refresh();
  }

  const grouped = useMemo(() => {
    const buckets: Record<string, Task[]> = { "En retard": [], "Aujourd'hui": [], "Cette semaine": [], "À venir": [], "Sans date": [], "Terminé": [] };
    for (const t of tasks) buckets[urgencyBucket(t).label]?.push(t);
    return buckets;
  }, [tasks]);

  const stats = useMemo(() => {
    const open = tasks.filter(t => t.status !== "done");
    const overdue = open.filter(t => t.due_at && new Date(t.due_at).getTime() < Date.now()).length;
    const today = open.filter(t => t.due_at && (new Date(t.due_at).getTime() - Date.now()) < 86_400_000 && (new Date(t.due_at).getTime() - Date.now()) > 0).length;
    const total_min = open.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
    return { open: open.length, overdue, today, total_min };
  }, [tasks]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4">
          <Link to="/tools" className="rounded-lg p-2 hover:bg-secondary" aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Cahier de textes intelligent</div>
            <div className="text-base font-semibold">Mes exercices</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {pushState !== "granted" && pushState !== "unsupported" && (
              <button onClick={enablePush}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
                <Bell className="h-3.5 w-3.5" /> Activer les rappels
              </button>
            )}
            {pushState === "granted" && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Bell className="h-3.5 w-3.5" /> Rappels actifs
              </span>
            )}
            <button onClick={() => setOpenNew(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow hover:opacity-90">
              <Plus className="h-4 w-4" /> Ajouter
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 space-y-6">
        {/* Barre de stats */}
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard icon={ListChecks} label="À faire" value={stats.open} tone="primary" />
          <StatCard icon={Flame} label="En retard" value={stats.overdue} tone="danger" />
          <StatCard icon={AlarmClock} label="Aujourd'hui" value={stats.today} tone="warn" />
          <StatCard icon={Clock} label="Temps estimé" value={`${Math.round(stats.total_min / 60 * 10) / 10} h`} tone="muted" />
        </section>

        {pushState === "denied" && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            Notifications bloquées dans le navigateur — active-les dans les paramètres du site pour recevoir les alertes urgentes.
          </div>
        )}

        {/* Filtres */}
        <div className="flex items-center gap-2 text-xs">
          {(["open","all","done"] as const).map(k => (
            <button key={k} onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1.5 font-medium border ${filter === k ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:bg-secondary"}`}>
              {k === "open" ? "En cours" : k === "all" ? "Tout" : "Terminés"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState onAdd={() => setOpenNew(true)} />
        ) : (
          <div className="space-y-6">
            {["En retard","Aujourd'hui","Cette semaine","À venir","Sans date","Terminé"].map(label => {
              const list = grouped[label] ?? [];
              if (list.length === 0) return null;
              return (
                <section key={label}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label} · {list.length}</h3>
                  <div className="grid gap-2">
                    {list.map(t => (
                      <TaskCard key={t.id} t={t}
                        onToggle={() => toggleDone(t)}
                        onOpen={() => setFocus(t)}
                        onSnooze={(h) => snooze(t, h)}
                        onDelete={() => remove(t)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {openNew && (
        <NewTaskDialog groups={groups} onClose={() => setOpenNew(false)} onCreated={() => { setOpenNew(false); void refresh(); }} />
      )}
      {focus && (
        <FocusDialog task={focus} onClose={() => setFocus(null)} onPatched={() => { void refresh(); }} />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Bell; label: string; value: number | string; tone: "primary"|"danger"|"warn"|"muted" }) {
  const toneClass =
    tone === "danger" ? "bg-red-500/10 text-red-600 dark:text-red-400" :
    tone === "warn" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
    tone === "primary" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function TaskCard({ t, onToggle, onOpen, onSnooze, onDelete }: {
  t: Task; onToggle: () => void; onOpen: () => void; onSnooze: (h: number) => void; onDelete: () => void;
}) {
  const u = urgencyBucket(t);
  return (
    <div className={`rounded-2xl border ${u.ring} bg-card p-4 transition hover:shadow-[var(--shadow-soft)]`}>
      <div className="flex items-start gap-3">
        <button onClick={onToggle}
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${
            t.status === "done" ? "border-emerald-500 bg-emerald-500 text-white" : "border-border hover:border-primary"
          }`}
          aria-label="Marquer fait">
          {t.status === "done" && <CheckCircle2 className="h-4 w-4" />}
        </button>
        <button onClick={onOpen} className="flex-1 text-left">
          <div className={`text-sm font-semibold leading-snug ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>
            {t.title}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${u.color}`}>{u.label}</span>
            {t.subject && <span className="rounded-full bg-secondary px-2 py-0.5">{t.subject}</span>}
            {t.chapter && <span className="hidden sm:inline">· {t.chapter}</span>}
            <span>· {formatDue(t.due_at)}</span>
            <span>· ~{t.estimated_minutes} min</span>
            {Array.from({ length: t.difficulty }).map((_, i) => <Zap key={i} className="h-3 w-3 text-amber-500" />)}
            {t.share_with_group && <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-primary"><Users className="h-3 w-3"/> partagé</span>}
          </div>
        </button>
        <div className="flex flex-col gap-1">
          <button onClick={() => onSnooze(24)} title="+ 24 h"
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary">
            <AlarmClock className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} title="Supprimer"
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Ton cahier de textes est vide</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Prends en photo l'exercice donné par le prof — l'IA détecte la matière, estime la durée et te rappelle avant l'échéance.
      </p>
      <button onClick={onAdd}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90">
        <Plus className="h-4 w-4" /> Ajouter mon premier exercice
      </button>
    </div>
  );
}

/* ---------------- New Task Dialog ---------------- */

function NewTaskDialog({ groups, onClose, onCreated }: { groups: Group[]; onClose: () => void; onCreated: () => void }) {
  const analyze = useServerFn(analyzeTaskSource);
  const create = useServerFn(createTask);
  const [mode, setMode] = useState<"photo" | "text" | "manual">("photo");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", subject: "", chapter: "", difficulty: 3, estimated_minutes: 30,
    due_at: defaultDueAt(), notes: "",
    group_id: "" as string, share_with_group: false,
    channels_email: true, channels_push: true,
  });
  const [ai, setAi] = useState<{ steps: string[]; hint: string; confidence: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function defaultDueAt() {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(20, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  }

  async function toDataUrl(f: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(f);
    });
  }

  async function runAnalyze() {
    setAnalyzing(true);
    try {
      const payload: { title?: string; sourceText?: string; imageDataUrl?: string; level?: string } = {};
      if (mode === "photo" && file) payload.imageDataUrl = await toDataUrl(file);
      if (mode === "text" && source.trim()) payload.sourceText = source.trim();
      if (mode === "manual" && form.title) payload.title = form.title;
      const res = await analyze({ data: payload });
      setForm(f => ({
        ...f,
        title: res.title || f.title,
        subject: res.subject || f.subject,
        chapter: res.chapter || f.chapter,
        difficulty: res.difficulty,
        estimated_minutes: res.estimated_minutes,
      }));
      setAi({ steps: res.steps, hint: res.hint, confidence: res.confidence });
      toast.success("IA a analysé l'énoncé ✨");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function submit() {
    if (!form.title.trim()) { toast.error("Ajoute un titre"); return; }
    setSaving(true);
    try {
      const channels: ("inapp"|"email"|"push")[] = ["inapp"];
      if (form.channels_email) channels.push("email");
      if (form.channels_push) channels.push("push");
      await create({ data: {
        title: form.title.trim(),
        subject: form.subject || undefined,
        chapter: form.chapter || undefined,
        difficulty: form.difficulty,
        estimated_minutes: form.estimated_minutes,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        notes: form.notes || undefined,
        source_type: mode === "photo" ? "photo" : mode === "text" ? "text" : "manual",
        source_content: mode === "text" ? source : undefined,
        ai_analysis: ai ? { steps: ai.steps, hint: ai.hint, confidence: ai.confidence } : undefined,
        group_id: form.group_id || null,
        share_with_group: form.share_with_group && !!form.group_id,
        channels,
      } });
      toast.success("Exercice ajouté ✅");
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur p-0 sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-border bg-background shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="font-semibold">Nouvel exercice</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode */}
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-secondary p-1">
            {(["photo","text","manual"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`rounded-lg px-2 py-1.5 text-xs font-medium ${mode === m ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
                {m === "photo" ? "📷 Photo" : m === "text" ? "📝 Texte" : "✏️ Manuel"}
              </button>
            ))}
          </div>

          {mode === "photo" && (
            <div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  setFile(f); setPreview(await toDataUrl(f));
                }}
              />
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="Aperçu" className="w-full rounded-xl border border-border object-cover max-h-64" />
                  <button onClick={() => { setFile(null); setPreview(null); }}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/30 px-6 py-10 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
                  <Camera className="h-6 w-6" />
                  Prendre l'énoncé en photo
                </button>
              )}
            </div>
          )}

          {mode === "text" && (
            <textarea value={source} onChange={(e) => setSource(e.target.value)}
              placeholder="Colle l'énoncé de l'exercice..."
              className="w-full min-h-[120px] rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          )}

          {(mode === "photo" ? preview : mode === "text" ? source.trim().length > 5 : form.title.length > 2) && (
            <button onClick={runAnalyze} disabled={analyzing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/20 disabled:opacity-60">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {analyzing ? "L'IA analyse..." : "Analyser avec l'IA"}
            </button>
          )}

          {ai && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
              <div className="mb-1 font-semibold text-primary">💡 Aperçu IA (confiance : {ai.confidence})</div>
              {ai.hint && <div className="text-muted-foreground"><b>Indice :</b> {ai.hint}</div>}
              {ai.steps?.length > 0 && (
                <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-muted-foreground">
                  {ai.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              )}
            </div>
          )}

          {/* Form */}
          <div className="space-y-2.5">
            <input required placeholder="Titre de l'exercice" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Matière" value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input placeholder="Chapitre" value={form.chapter}
                onChange={(e) => setForm({ ...form, chapter: e.target.value })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">
                Échéance
                <input type="datetime-local" value={form.due_at}
                  onChange={(e) => setForm({ ...form, due_at: e.target.value })}
                  className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" />
              </label>
              <label className="text-xs text-muted-foreground">
                Durée (min)
                <input type="number" min={5} max={600} value={form.estimated_minutes}
                  onChange={(e) => setForm({ ...form, estimated_minutes: +e.target.value || 30 })}
                  className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm" />
              </label>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Difficulté</div>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setForm({ ...form, difficulty: n })}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-medium ${form.difficulty === n ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-secondary"}`}>
                    {"⚡".repeat(n)}
                  </button>
                ))}
              </div>
            </div>

            {groups.length > 0 && (
              <div className="rounded-lg border border-border bg-secondary/40 p-2.5">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input type="checkbox" checked={form.share_with_group}
                    onChange={(e) => setForm({ ...form, share_with_group: e.target.checked })} />
                  <Users className="h-3.5 w-3.5" /> Partager dans un groupe
                </label>
                {form.share_with_group && (
                  <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                    className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
                    <option value="">Choisir un groupe…</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-600 dark:text-emerald-400"><Bell className="h-3 w-3"/> Cloche (auto)</span>
              <label className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 cursor-pointer">
                <input type="checkbox" checked={form.channels_push}
                  onChange={(e) => setForm({ ...form, channels_push: e.target.checked })} />
                Notif navigateur
              </label>
              <label className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 cursor-pointer opacity-80">
                <input type="checkbox" checked={form.channels_email}
                  onChange={(e) => setForm({ ...form, channels_email: e.target.checked })} />
                Email (bientôt)
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-medium hover:bg-secondary">Annuler</button>
            <button onClick={submit} disabled={saving || !form.title.trim()}
              className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Enregistrement..." : "Ajouter l'exercice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Focus / Timer Dialog ---------------- */

function FocusDialog({ task, onClose, onPatched }: { task: Task; onClose: () => void; onPatched: () => void }) {
  const patch = useServerFn(updateTask);
  const target = task.estimated_minutes * 60;
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [grade, setGrade] = useState<string>("");

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const pct = Math.min(100, (elapsed / target) * 100);

  async function finish() {
    const g = grade ? Math.max(0, Math.min(20, Number(grade))) : null;
    await patch({ data: { id: task.id, patch: {
      status: "done",
      actual_minutes: Math.max(1, Math.round(elapsed / 60)),
      self_grade: g,
    } } });
    toast.success("Bravo ! Exercice terminé 🎉");
    onPatched(); onClose();
  }

  const ai = (task.ai_analysis as { steps?: string[]; hint?: string } | null) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur p-0 sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-border bg-background shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-2 min-w-0">
            <Play className="h-4 w-4 text-primary" />
            <div className="truncate font-semibold text-sm">{task.title}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="text-center">
            <div className="text-6xl font-bold tabular-nums tracking-tight">{mm}:{ss}</div>
            <div className="mt-1 text-xs text-muted-foreground">Objectif ~{task.estimated_minutes} min</div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="flex justify-center gap-2">
            <button onClick={() => setRunning(r => !r)}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow">
              {running ? "Pause" : elapsed === 0 ? "Démarrer" : "Reprendre"}
            </button>
            <button onClick={() => { setRunning(false); setElapsed(0); }}
              className="rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-secondary">
              Reset
            </button>
          </div>

          {ai && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
              <div className="mb-1 font-semibold text-primary">🧭 Plan de résolution</div>
              {ai.hint && <div className="text-muted-foreground mb-1"><b>Indice :</b> {ai.hint}</div>}
              {ai.steps && ai.steps.length > 0 && (
                <ol className="list-decimal space-y-0.5 pl-4 text-muted-foreground">
                  {ai.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Link to="/ai" className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-card px-3 py-2 font-medium hover:bg-secondary">
              <Sparkles className="h-3.5 w-3.5" /> Demander à l'IA
            </Link>
            <Link to="/tools/exercises" className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-card px-3 py-2 font-medium hover:bg-secondary">
              <Zap className="h-3.5 w-3.5" /> Générer un similaire
            </Link>
          </div>

          <div className="border-t border-border pt-4">
            <label className="text-xs font-medium text-muted-foreground">Note (sur 20, optionnel)</label>
            <input type="number" min={0} max={20} value={grade} onChange={(e) => setGrade(e.target.value)}
              placeholder="Auto-évaluation"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <button onClick={finish}
              className="mt-3 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-600">
              Marquer comme fait
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Silence unused-import warnings for icons used conditionally
void BellOff;