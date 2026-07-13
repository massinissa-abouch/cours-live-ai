import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Send, Paperclip, Calendar, Bell, Timer, Users, Copy, Check, Trash2,
  LogOut, Download, Sparkles, Play, X,
} from "lucide-react";
import {
  getGroupDetail, sendGroupMessage, signResourceUpload, registerResource,
  signResourceDownload, deleteResource, createGroupEvent, deleteGroupEvent,
  createExamAlert, deleteExamAlert, startPomodoro, leaveGroup, deleteGroup,
} from "@/lib/groups.functions";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  component: GroupDetail,
});

type Detail = Awaited<ReturnType<typeof getGroupDetail>>;
type Msg = Detail["messages"][number];
type Res = Detail["resources"][number];
type Evt = Detail["events"][number];
type Alert = Detail["alerts"][number];

type Tab = "chat" | "resources" | "events" | "alerts" | "pomodoro";

function GroupDetail() {
  const { groupId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const load = useServerFn(getGroupDetail);
  const [state, setState] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [presenceCount, setPresenceCount] = useState(1);

  useEffect(() => {
    (async () => { setState(await load({ data: { groupId } })); })();
  }, [groupId, load]);

  // Realtime: new messages + pomodoro + presence
  useEffect(() => {
    const channel = supabase.channel(`group:${groupId}`, { config: { presence: { key: user.id } } })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const m = payload.new as Msg;
          setState((s) => s && s.messages.some((x) => x.id === m.id) ? s : (s && { ...s, messages: [...s.messages, m] }));
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "group_pomodoro_sessions", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const p = payload.new as NonNullable<Detail["pomodoro"]>;
          setState((s) => s && { ...s, pomodoro: p });
        })
      .on("presence", { event: "sync" }, () => {
        const s = channel.presenceState();
        setPresenceCount(Object.keys(s).length || 1);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ online_at: new Date().toISOString() });
      });
    return () => { supabase.removeChannel(channel); };
  }, [groupId, user.id]);

  if (!state) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;
  const isOwner = state.group.owner_id === user.id;
  const profileMap = new Map(state.profiles.map((p) => [p.id, p]));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Link to="/groups" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{state.group.name}</div>
            <div className="text-xs text-muted-foreground">
              {state.group.subject} · {state.group.level} · {state.members.length} membres · {presenceCount} en ligne
            </div>
          </div>
          <CopyCode code={state.group.invite_code} />
          <GroupMenu
            isOwner={isOwner}
            onLeave={async () => {
              if (!confirm("Quitter ce groupe ?")) return;
              await leaveGroup({ data: { groupId } });
              navigate({ to: "/groups" });
            }}
            onDelete={async () => {
              if (!confirm("Supprimer définitivement ce groupe ?")) return;
              await deleteGroup({ data: { groupId } });
              navigate({ to: "/groups" });
            }}
          />
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-2 overflow-x-auto">
          <div className="flex gap-1">
            {(
              [["chat", "Chat", null], ["resources", "Ressources", null], ["events", "Calendrier", null], ["alerts", "Alertes contrôle", null], ["pomodoro", "Pomodoro", null]] as [Tab, string, null][]
            ).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {tab === "chat" && <ChatTab groupId={groupId} messages={state.messages} userId={user.id} profileMap={profileMap} />}
        {tab === "resources" && <ResourcesTab groupId={groupId} resources={state.resources} userId={user.id} ownerId={state.group.owner_id}
          onChange={async () => setState(await load({ data: { groupId } }))} />}
        {tab === "events" && <EventsTab groupId={groupId} events={state.events} userId={user.id} ownerId={state.group.owner_id}
          onChange={async () => setState(await load({ data: { groupId } }))} />}
        {tab === "alerts" && <AlertsTab groupId={groupId} alerts={state.alerts} subject={state.group.subject} userId={user.id} ownerId={state.group.owner_id}
          onChange={async () => setState(await load({ data: { groupId } }))} />}
        {tab === "pomodoro" && <PomodoroTab groupId={groupId} pomodoro={state.pomodoro} presenceCount={presenceCount} />}
      </main>
    </div>
  );
}

function CopyCode({ code }: { code: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(code); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] font-mono hover:bg-secondary/80">
      {ok ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {code}
    </button>
  );
}

function GroupMenu({ isOwner, onLeave, onDelete }: { isOwner: boolean; onLeave: () => void; onDelete: () => void }) {
  return (
    <button onClick={isOwner ? onDelete : onLeave}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary">
      {isOwner ? <><Trash2 className="h-3.5 w-3.5" /> Supprimer</> : <><LogOut className="h-3.5 w-3.5" /> Quitter</>}
    </button>
  );
}

// ============== CHAT ==============
function ChatTab({ groupId, messages, userId, profileMap }: {
  groupId: string; messages: Msg[]; userId: string;
  profileMap: Map<string, { id: string; full_name: string | null; avatar_url: string | null }>;
}) {
  const send = useServerFn(sendGroupMessage);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(messages);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMsgs(messages); }, [messages]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [msgs.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await send({ data: { groupId, body: text.trim() } });
      setText("");
    } finally { setSending(false); }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] rounded-2xl border border-border bg-card">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {msgs.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">Commencez la conversation.</div>}
        {msgs.map((m) => {
          const mine = m.author_id === userId;
          const p = profileMap.get(m.author_id);
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                {!mine && <div className="text-[10px] font-semibold opacity-70 mb-0.5">{p?.full_name ?? "Élève"}</div>}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className={`text-[10px] mt-1 ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
        <input value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button disabled={sending || !text.trim()} className="rounded-lg bg-primary px-3 text-primary-foreground disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

// ============== RESOURCES ==============
function ResourcesTab({ groupId, resources, userId, ownerId, onChange }: {
  groupId: string; resources: Res[]; userId: string; ownerId: string; onChange: () => void;
}) {
  const signUpload = useServerFn(signResourceUpload);
  const register = useServerFn(registerResource);
  const signDl = useServerFn(signResourceDownload);
  const del = useServerFn(deleteResource);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const { path, token } = await signUpload({ data: { groupId, fileName: file.name } });
      const { error } = await supabase.storage.from("group-resources").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      await register({ data: { groupId, title: file.name, storagePath: path, mimeType: file.type, sizeBytes: file.size } });
      onChange();
    } catch (err) { setError((err as Error).message); }
    finally { setUploading(false); e.target.value = ""; }
  }

  async function open(r: Res) {
    const { url } = await signDl({ data: { groupId, path: r.storage_path } });
    window.open(url, "_blank", "noopener");
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card px-4 py-6 text-sm cursor-pointer hover:border-primary/40">
        <Paperclip className="h-4 w-4" />
        {uploading ? "Envoi…" : "Ajouter un fichier partagé"}
        <input type="file" className="hidden" onChange={onFile} disabled={uploading} />
      </label>
      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      {resources.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">Aucun fichier partagé.</div>
      ) : (
        <div className="grid gap-2">
          {resources.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <Paperclip className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.title}</div>
                <div className="text-xs text-muted-foreground">
                  {r.mime_type ?? "—"} · {r.size_bytes ? `${(r.size_bytes / 1024).toFixed(0)} Ko` : ""} · {new Date(r.created_at).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <button onClick={() => open(r)} className="rounded-md p-2 hover:bg-secondary"><Download className="h-4 w-4" /></button>
              {(r.uploader_id === userId || ownerId === userId) && (
                <button onClick={async () => { if (confirm("Supprimer ?")) { await del({ data: { id: r.id } }); onChange(); } }}
                  className="rounded-md p-2 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== EVENTS ==============
function EventsTab({ groupId, events, userId, ownerId, onChange }: {
  groupId: string; events: Evt[]; userId: string; ownerId: string; onChange: () => void;
}) {
  const create = useServerFn(createGroupEvent);
  const del = useServerFn(deleteGroupEvent);
  const [form, setForm] = useState({ title: "", description: "", eventAt: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { groupId, title: form.title, description: form.description || undefined, eventAt: new Date(form.eventAt).toISOString() } });
      setForm({ title: "", description: "", eventAt: "" });
      onChange();
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1"><Calendar className="h-4 w-4 text-primary" /><h3 className="font-semibold">Nouvel événement</h3></div>
        <input required placeholder="Titre (ex. Révision chapitre 3)" value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input required type="datetime-local" value={form.eventAt}
          onChange={(e) => setForm({ ...form, eventAt: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <textarea placeholder="Description" value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[60px]" />
        <button disabled={busy} className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? "…" : "Créer"}
        </button>
      </form>
      <div className="space-y-2">
        {events.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Aucun événement.</div>}
        {events.map((ev) => (
          <div key={ev.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{ev.title}</div>
                <div className="text-xs text-primary">{new Date(ev.event_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</div>
                {ev.description && <div className="text-xs text-muted-foreground mt-1">{ev.description}</div>}
              </div>
              {(ev.created_by === userId || ownerId === userId) && (
                <button onClick={async () => { if (confirm("Supprimer ?")) { await del({ data: { id: ev.id } }); onChange(); } }}
                  className="rounded-md p-1 text-destructive hover:bg-destructive/10">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== EXAM ALERTS ==============
function AlertsTab({ groupId, alerts, subject, userId, ownerId, onChange }: {
  groupId: string; alerts: Alert[]; subject: string; userId: string; ownerId: string; onChange: () => void;
}) {
  const create = useServerFn(createExamAlert);
  const del = useServerFn(deleteExamAlert);
  const [form, setForm] = useState({ subject: subject, examDate: "", chapters: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const chapters = form.chapters.split(",").map((c) => c.trim()).filter(Boolean);
      if (!chapters.length) throw new Error("Ajoute au moins un chapitre");
      await create({ data: { groupId, subject: form.subject, examDate: form.examDate, chapters } });
      setForm({ subject: subject, examDate: "", chapters: "" });
      onChange();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1"><Bell className="h-4 w-4 text-primary" /><h3 className="font-semibold">Annoncer un contrôle</h3><span className="text-xs text-muted-foreground">→ checklist + quiz IA</span></div>
        <div className="grid grid-cols-2 gap-2">
          <input required placeholder="Matière" value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input required type="date" value={form.examDate}
            onChange={(e) => setForm({ ...form, examDate: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <input required placeholder="Chapitres (séparés par virgules)" value={form.chapters}
          onChange={(e) => setForm({ ...form, chapters: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          <Sparkles className="h-4 w-4" />
          {busy ? "Génération IA…" : "Créer l'alerte + générer checklist & quiz"}
        </button>
        {error && <div className="text-xs text-destructive">{error}</div>}
      </form>

      {alerts.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Aucune alerte de contrôle.</div>}
      {alerts.map((a) => <AlertCard key={a.id} alert={a} canDelete={a.created_by === userId || ownerId === userId}
        onDelete={async () => { if (confirm("Supprimer ?")) { await del({ data: { id: a.id } }); onChange(); } }} />)}
    </div>
  );
}

function AlertCard({ alert, canDelete, onDelete }: { alert: Alert; canDelete: boolean; onDelete: () => void }) {
  const checklist = (alert.checklist as unknown as { item: string }[]) ?? [];
  const quiz = (alert.quiz as unknown as { question: string; answer: string }[]) ?? [];
  const [showAnswers, setShowAnswers] = useState<Record<number, boolean>>({});
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="font-semibold">{alert.subject} — {new Date(alert.exam_date).toLocaleDateString("fr-FR")}</div>
          <div className="text-xs text-muted-foreground">Chapitres : {(alert.chapters ?? []).join(", ")}</div>
        </div>
        {canDelete && <button onClick={onDelete} className="rounded-md p-1 text-destructive hover:bg-destructive/10"><X className="h-4 w-4" /></button>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Checklist</h4>
          <ul className="space-y-1 text-sm">
            {checklist.map((c, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span>{c.item}</li>)}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Quiz de révision</h4>
          <ol className="space-y-2 text-sm list-decimal list-inside">
            {quiz.map((q, i) => (
              <li key={i}>
                <span>{q.question}</span>
                <button onClick={() => setShowAnswers((s) => ({ ...s, [i]: !s[i] }))}
                  className="ml-2 text-xs text-primary hover:underline">
                  {showAnswers[i] ? "Cacher" : "Voir réponse"}
                </button>
                {showAnswers[i] && <div className="mt-1 rounded-md bg-secondary/60 px-2 py-1 text-xs">{q.answer}</div>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

// ============== POMODORO ==============
function PomodoroTab({ groupId, pomodoro, presenceCount }: {
  groupId: string; pomodoro: Detail["pomodoro"]; presenceCount: number;
}) {
  const start = useServerFn(startPomodoro);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const active = pomodoro && new Date(pomodoro.ends_at).getTime() > now;
  const remain = useMemo(() => {
    if (!active || !pomodoro) return 0;
    return Math.max(0, Math.floor((new Date(pomodoro.ends_at).getTime() - now) / 1000));
  }, [active, pomodoro, now]);
  const mm = String(Math.floor(remain / 60)).padStart(2, "0");
  const ss = String(remain % 60).padStart(2, "0");

  async function launch(phase: "focus" | "break", durationMin: number) {
    setBusy(true);
    try { await start({ data: { groupId, phase, durationMin } }); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Users className="h-4 w-4" /> {presenceCount} camarade{presenceCount > 1 ? "s" : ""} en ligne avec toi
      </div>
      <div className="my-6">
        <div className="text-6xl font-mono font-bold tracking-wider">{active ? `${mm}:${ss}` : "25:00"}</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {active ? (pomodoro?.phase === "focus" ? "🎯 Focus en cours" : "☕ Pause") : "Aucune session active"}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button disabled={busy} onClick={() => launch("focus", 25)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          <Play className="h-4 w-4" /> Focus 25 min
        </button>
        <button disabled={busy} onClick={() => launch("focus", 50)}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50">Focus 50 min</button>
        <button disabled={busy} onClick={() => launch("break", 5)}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50">
          <Timer className="inline h-4 w-4 mr-1" /> Pause 5 min
        </button>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">Le compte à rebours est synchronisé pour tout le groupe.</p>
    </div>
  );
}