import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, FileText, Loader2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { listMemoSheets, generateMemoSheet, deleteMemoSheet } from "@/lib/memo.functions";

export const Route = createFileRoute("/_authenticated/tools/memo")({
  component: MemoPage,
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

type Sheet = Awaited<ReturnType<typeof listMemoSheets>>[number];

function MemoPage() {
  const load = useServerFn(listMemoSheets);
  const del = useServerFn(deleteMemoSheet);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setSheets(await load()); } finally { setLoading(false); }
  }, [load]);

  useEffect(() => { void refresh(); }, [refresh]);

  const bySubject = sheets.reduce<Record<string, Sheet[]>>((acc, s) => {
    const k = s.subject || "Autre";
    (acc[k] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-2 px-4">
          <Link to="/tools" className="rounded-lg p-2 hover:bg-secondary" aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Mémo Express</div>
            <div className="text-base font-semibold">Cours long → fiche mémo</div>
          </div>
          <button onClick={() => setOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow hover:opacity-90">
            <Plus className="h-4 w-4" /> Nouvelle fiche
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : sheets.length === 0 ? (
          <EmptyState onNew={() => setOpen(true)} />
        ) : (
          <div className="space-y-8">
            {Object.entries(bySubject).map(([subject, list]) => (
              <section key={subject}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {subject} · {list.length}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {list.map((s) => (
                    <SheetCard key={s.id} s={s} onDelete={async () => {
                      if (!confirm("Supprimer cette fiche ?")) return;
                      await del({ data: { id: s.id } });
                      void refresh();
                    }} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {open && (
        <NewSheetDialog onClose={() => setOpen(false)} onCreated={(id) => { setOpen(false); void refresh(); void id; }} />
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold">Transforme un cours long en fiche facile</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Colle un chapitre entier ou prends-le en photo. L'IA le découpe en petits blocs, invente des moyens mnémotechniques et te fait un quiz flash.
      </p>
      <button onClick={onNew} className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        <Plus className="h-4 w-4" /> Créer ma première fiche
      </button>
    </div>
  );
}

function SheetCard({ s, onDelete }: { s: Sheet; onDelete: () => void }) {
  return (
    <div className="group relative rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <Link to="/tools/memo/$sheetId" params={{ sheetId: s.id }} className="block">
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{s.subject || "Autre"}</span>
          {s.level && <span>· {s.level}</span>}
        </div>
        <h3 className="text-base font-semibold leading-snug">{s.title}</h3>
        {s.chapter && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.chapter}</p>}
        <div className="mt-3 text-[11px] text-muted-foreground">
          Créée le {new Date(s.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
        </div>
      </Link>
      <button onClick={onDelete} aria-label="Supprimer"
        className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------- New sheet dialog ----------------

function NewSheetDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const gen = useServerFn(generateMemoSheet);
  const nav = useNavigate();
  const [mode, setMode] = useState<"text" | "photo">("text");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [level, setLevel] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickImage(f: File) {
    if (f.size > 5_000_000) { toast.error("Photo trop lourde (max 5 Mo)"); return; }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result || ""));
    reader.readAsDataURL(f);
  }

  async function submit() {
    if (mode === "text" && text.trim().length < 100) { toast.error("Colle un cours d'au moins 100 caractères"); return; }
    if (mode === "photo" && !image) { toast.error("Ajoute une photo du cours"); return; }
    setBusy(true);
    try {
      const res = await gen({
        data: {
          sourceText: mode === "text" ? text.trim() : undefined,
          imageDataUrl: mode === "photo" && image ? image : undefined,
          level: level || undefined,
          hintSubject: hint || undefined,
        },
      });
      toast.success("Fiche générée ✨");
      onCreated(res.id);
      void nav({ to: "/tools/memo/$sheetId", params: { sheetId: res.id } });
    } catch (e) {
      toast.error((e as Error).message || "Génération échouée");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal>
      <div className="w-full max-w-2xl overflow-hidden rounded-t-2xl border border-border bg-card sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="font-semibold">Nouvelle fiche mémo</div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary">✕</button>
        </div>

        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-4">
          <div className="flex gap-2 text-xs">
            <button onClick={() => setMode("text")}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium ${mode === "text" ? "bg-foreground text-background border-foreground" : "bg-card border-border"}`}>
              <FileText className="h-3.5 w-3.5" /> Coller le cours
            </button>
            <button onClick={() => setMode("photo")}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium ${mode === "photo" ? "bg-foreground text-background border-foreground" : "bg-card border-border"}`}>
              <Camera className="h-3.5 w-3.5" /> Photo
            </button>
          </div>

          {mode === "text" ? (
            <textarea value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Colle ici ton chapitre d'histoire, ta leçon de géo, etc. (jusqu'à plusieurs pages)"
              className="min-h-[220px] w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
          ) : (
            <div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
                onChange={(e) => e.target.files?.[0] && onPickImage(e.target.files[0])} />
              {image ? (
                <div className="relative">
                  <img src={image} alt="cours" className="max-h-80 w-full rounded-lg border border-border object-contain" />
                  <button onClick={() => setImage(null)} className="absolute right-2 top-2 rounded-md bg-background/90 px-2 py-1 text-xs">Changer</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="grid h-40 w-full place-items-center rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground hover:bg-secondary">
                  <div className="flex flex-col items-center gap-2">
                    <Camera className="h-6 w-6" />
                    Prendre / choisir une photo du cours
                  </div>
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Niveau (ex: 3AS)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Matière (ex: Histoire)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          <p className="text-[11px] text-muted-foreground">
            L'IA va découper le cours en 3-8 blocs, écrire un résumé, inventer des moyens mnémotechniques et créer un mini-quiz. Ça peut prendre 10-30 secondes.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-background/60 px-4 py-3">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm hover:bg-secondary">Annuler</button>
          <button onClick={submit} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {busy ? "Génération…" : "Générer la fiche"}
          </button>
        </div>
      </div>
    </div>
  );
}
