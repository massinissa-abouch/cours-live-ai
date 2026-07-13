import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Upload, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { saveArchiveEntry, deleteArchiveEntry, signArchiveUpload } from "@/lib/exam-archive.functions";

export const Route = createFileRoute("/_authenticated/admin_/archive")({
  component: AdminArchivePage,
});

type Row = {
  id: string; exam_type: "bem" | "bac"; year: number; subject: string;
  filiere: string | null; title: string; pdf_url: string; correction_url: string | null;
};

const SUBJECTS = ["Mathématiques","Physique","Sciences naturelles","Arabe","Français","Anglais","Philosophie","Histoire-Géographie","Éducation islamique"];

function AdminArchivePage() {
  const { user } = Route.useRouteContext();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const save = useServerFn(saveArchiveEntry);
  const del = useServerFn(deleteArchiveEntry);
  const signUp = useServerFn(signArchiveUpload);

  const [form, setForm] = useState({
    exam_type: "bac" as "bem" | "bac", year: new Date().getFullYear(),
    subject: SUBJECTS[0], filiere: "", title: "",
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [corrFile, setCorrFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data } = await supabase.from("exam_archive")
      .select("id,exam_type,year,subject,filiere,title,pdf_url,correction_url")
      .order("year", { ascending: false }).order("subject");
    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const admin = (data ?? []).some((r) => r.role === "admin");
      setIsAdmin(admin);
      if (admin) refresh();
    })();
  }, [user.id]);

  async function uploadOne(f: File) {
    const ext = f.name.split(".").pop() ?? "pdf";
    const { path, token } = await signUp({ data: { ext } });
    const { error } = await supabase.storage.from("exam-archive")
      .uploadToSignedUrl(path, token, f, { contentType: f.type || "application/pdf" });
    if (error) throw error;
    return path;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pdfFile) { toast.error("Ajoute le PDF du sujet."); return; }
    setBusy(true);
    try {
      const pdf_path = await uploadOne(pdfFile);
      const correction_path = corrFile ? await uploadOne(corrFile) : null;
      await save({ data: { ...form, pdf_path, correction_path, filiere: form.filiere || null } });
      toast.success("Sujet ajouté à l'archive.");
      setForm({ ...form, title: "" });
      setPdfFile(null); setCorrFile(null);
      const fileInputs = document.querySelectorAll<HTMLInputElement>("input[type=file]");
      fileInputs.forEach((i) => (i.value = ""));
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'upload");
    } finally { setBusy(false); }
  }

  async function onDelete(id: string) {
    if (!confirm("Supprimer ce sujet ?")) return;
    try {
      await del({ data: { id } });
      setRows(rows.filter((r) => r.id !== id));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  }

  if (isAdmin === null) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  if (!isAdmin) return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Accès refusé : cette page est réservée aux administrateurs.
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <Link to="/admin" className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
        <h1 className="text-2xl font-bold">Archive — Upload de sujets</h1>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Examen</span>
          <select value={form.exam_type}
            onChange={(e) => setForm({ ...form, exam_type: e.target.value as "bem" | "bac" })}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="bac">BAC</option><option value="bem">BEM</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Année</span>
          <input type="number" min={2000} max={2100} value={form.year}
            onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Matière</span>
          <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filière (BAC)</span>
          <input value={form.filiere} onChange={(e) => setForm({ ...form, filiere: e.target.value })}
            placeholder="ex : Sciences expérimentales"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="md:col-span-2 block">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Titre</span>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="ex : Sujet officiel — Session juin"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PDF sujet *</span>
          <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PDF corrigé (optionnel)</span>
          <input type="file" accept="application/pdf" onChange={(e) => setCorrFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm" />
        </label>
        <div className="md:col-span-2">
          <button disabled={busy} type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-90 disabled:opacity-60">
            <Upload className="h-4 w-4" /> {busy ? "Upload en cours…" : "Ajouter à l'archive"}
          </button>
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Sujets existants ({rows.length})</h2>
        <div className="grid gap-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="flex-1">
                <div className="text-sm font-semibold">{r.title}</div>
                <div className="text-xs text-muted-foreground">
                  {r.exam_type.toUpperCase()} · {r.year} · {r.subject}{r.filiere && ` · ${r.filiere}`}
                  {r.correction_url ? " · avec corrigé" : ""}
                </div>
              </div>
              <button onClick={() => onDelete(r.id)}
                className="rounded-lg p-2 text-destructive hover:bg-destructive/10" aria-label="Supprimer">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}