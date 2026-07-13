import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Archive, FileText, Sparkles, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { signArchiveRead } from "@/lib/exam-archive.functions";
import { createConversation } from "@/lib/ai-conversations.functions";

export const Route = createFileRoute("/_authenticated/archive")({
  component: ArchivePage,
});

type Row = {
  id: string;
  exam_type: "bem" | "bac";
  year: number;
  subject: string;
  filiere: string | null;
  title: string;
  pdf_url: string;
  correction_url: string | null;
};

const SUBJECTS = [
  "Mathématiques", "Physique", "Sciences naturelles", "Arabe",
  "Français", "Anglais", "Philosophie", "Histoire-Géographie", "Éducation islamique",
];
const YEARS = Array.from({ length: 2025 - 2008 + 1 }, (_, i) => 2025 - i);

function ArchivePage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"all" | "bem" | "bac">("all");
  const [year, setYear] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const sign = useServerFn(signArchiveRead);
  const startConv = useServerFn(createConversation);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("exam_archive")
        .select("id,exam_type,year,subject,filiere,title,pdf_url,correction_url")
        .order("year", { ascending: false })
        .order("subject");
      if (error) toast.error(error.message);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => rows.filter((r) =>
    (type === "all" || r.exam_type === type)
    && (!year || r.year === Number(year))
    && (!subject || r.subject === subject)
  ), [rows, type, year, subject]);

  async function openPdf(path: string) {
    try {
      const { signedUrl } = await sign({ data: { path } });
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function askAi(row: Row) {
    try {
      const level = row.exam_type === "bem" ? "cem_4" : "lycee_3_sciences";
      const { id } = await startConv({
        data: {
          subject: row.subject,
          level,
          chapter: `Sujet officiel ${row.exam_type.toUpperCase()} ${row.year}${row.filiere ? ` — ${row.filiere}` : ""} : ${row.title}`,
          title: `Aide ${row.exam_type.toUpperCase()} ${row.year} — ${row.subject}`,
        },
      });
      navigate({ to: "/ai/c/$conversationId", params: { conversationId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/dashboard" className="rounded-lg p-2 hover:bg-secondary" aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Archive className="h-4 w-4 text-primary" />
          <div className="font-semibold">Archive Bac & BEM</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight">Sujets d'examens officiels</h1>
        <p className="mt-2 text-muted-foreground">Sujets et corrigés du BEM et du BAC de 2008 à aujourd'hui.</p>

        <div className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Examen</div>
            <div className="flex gap-1">
              {(["all", "bac", "bem"] as const).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${type === t ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  {t === "all" ? "Tous" : t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Année</span>
            <select value={year} onChange={(e) => setYear(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
              <option value="">Toutes</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Matière</span>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
              <option value="">Toutes</option>
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <div className="ml-auto text-xs text-muted-foreground">
            {loading ? "Chargement…" : `${filtered.length} sujet${filtered.length > 1 ? "s" : ""}`}
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {!loading && filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Aucun sujet dans l'archive avec ces filtres. L'archive est en cours de constitution — reviens bientôt.
            </div>
          )}
          {filtered.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{r.title}</div>
                <div className="text-xs text-muted-foreground">
                  {r.exam_type.toUpperCase()} · {r.year} · {r.subject}
                  {r.filiere && ` · ${r.filiere}`}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openPdf(r.pdf_url)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-primary/50">
                  <ExternalLink className="h-3.5 w-3.5" /> Sujet
                </button>
                {r.correction_url && (
                  <button onClick={() => openPdf(r.correction_url!)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-primary/50">
                    <ExternalLink className="h-3.5 w-3.5" /> Corrigé
                  </button>
                )}
                <button onClick={() => askAi(r)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
                  <Sparkles className="h-3.5 w-3.5" /> Aide IA
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}