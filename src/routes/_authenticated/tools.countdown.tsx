import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Timer, Plus, Check, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/tools/countdown")({
  component: CountdownPage,
});

// Dates par défaut si aucune ligne en base — roule vers l'année suivante si déjà passée.
function fallbackDate(exam: "bem" | "bac"): string {
  const md = exam === "bac" ? "06-15" : "06-10";
  const now = new Date();
  const y = now.getFullYear();
  const thisYear = new Date(`${y}-${md}`);
  const targetYear = thisYear.getTime() < now.getTime() ? y + 1 : y;
  return `${targetYear}-${md}`;
}

type ChecklistItem = { id: string; subject: string; chapter: string; done: boolean };

function storageKey(userId: string) {
  return `ostadi.exam.checklist.${userId}`;
}

function CountdownPage() {
  const { user } = Route.useRouteContext();
  const [exam, setExam] = useState<"bem" | "bac">("bac");
  const [examDate, setExamDate] = useState<string | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [subj, setSubj] = useState("");
  const [chap, setChap] = useState("");

  // load student's exam target + persisted checklist
  useEffect(() => {
    (async () => {
      const { data: prof } = await supabase
        .from("student_profiles")
        .select("exam_target")
        .eq("user_id", user.id)
        .maybeSingle();
      const target = (prof?.exam_target === "bem" || prof?.exam_target === "bac") ? prof.exam_target : "bac";
      setExam(target);

      const { data: row } = await supabase
        .from("exam_countdowns")
        .select("exam_date")
        .eq("exam", target)
        .order("year", { ascending: false })
        .limit(1)
        .maybeSingle();
      setExamDate(row?.exam_date ?? fallbackDate(target));
    })();

    try {
      const raw = localStorage.getItem(storageKey(user.id));
      if (raw) setItems(JSON.parse(raw) as ChecklistItem[]);
    } catch { /* ignore */ }
  }, [user.id]);

  useEffect(() => {
    try { localStorage.setItem(storageKey(user.id), JSON.stringify(items)); } catch { /* ignore */ }
  }, [items, user.id]);

  const daysLeft = useMemo(() => {
    if (!examDate) return null;
    const t = new Date(examDate).getTime();
    const diff = Math.ceil((t - Date.now()) / 86_400_000);
    return diff;
  }, [examDate]);

  async function switchExam(v: "bem" | "bac") {
    setExam(v);
    const { data: row } = await supabase
      .from("exam_countdowns").select("exam_date").eq("exam", v)
      .order("year", { ascending: false }).limit(1).maybeSingle();
    setExamDate(row?.exam_date ?? fallbackDate(v));
  }

  function addItem() {
    if (!subj.trim() || !chap.trim()) return;
    setItems([{ id: crypto.randomUUID(), subject: subj.trim(), chapter: chap.trim(), done: false }, ...items]);
    setSubj(""); setChap("");
  }

  const bySubject = useMemo(() => {
    const m: Record<string, ChecklistItem[]> = {};
    for (const it of items) (m[it.subject] ??= []).push(it);
    return m;
  }, [items]);

  const done = items.filter((i) => i.done).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <Link to="/tools" className="rounded-lg p-2 hover:bg-secondary" aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Timer className="h-4 w-4 text-primary" />
          <div className="font-semibold">Compte à rebours</div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap gap-2">
          {(["bac", "bem"] as const).map((v) => (
            <button key={v} onClick={() => switchExam(v)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                exam === v ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"
              }`}>{v === "bac" ? "BAC" : "BEM"}</button>
          ))}
        </div>

        <section className="mt-6 rounded-3xl p-8 text-primary-foreground shadow-[var(--shadow-lift)]" style={{ background: "var(--gradient-hero)" }}>
          <div className="text-sm uppercase tracking-wider opacity-80">
            {exam === "bac" ? "Baccalauréat" : "BEM"} · {examDate ? new Date(examDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—"}
          </div>
          <div className="mt-2 text-6xl font-bold leading-none">
            {daysLeft === null ? "—" : daysLeft > 0 ? daysLeft : 0}
            <span className="ml-2 text-2xl opacity-80">{daysLeft === 1 ? "jour" : "jours"} restant{daysLeft !== 1 ? "s" : ""}</span>
          </div>
          <div className="mt-3 max-w-md text-sm text-white/90">
            {items.length > 0
              ? `Checklist : ${done}/${items.length} chapitres révisés.`
              : "Ajoute les chapitres que tu dois réviser ci-dessous."}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Ajouter un chapitre à réviser</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={subj} onChange={(e) => setSubj(e.target.value)} placeholder="Matière (ex: Maths)"
              className="flex-1 min-w-[10rem] rounded-lg border border-border bg-card px-3 py-2 text-sm" />
            <input value={chap} onChange={(e) => setChap(e.target.value)} placeholder="Chapitre (ex: Fonctions numériques)"
              className="flex-[2] min-w-[14rem] rounded-lg border border-border bg-card px-3 py-2 text-sm" />
            <button onClick={addItem} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <Plus className="inline h-4 w-4" /> Ajouter
            </button>
          </div>
        </section>

        <section className="mt-8 space-y-6">
          {Object.keys(bySubject).length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Aucun chapitre ajouté. Commence par lister les gros morceaux du programme.
            </div>
          )}
          {Object.entries(bySubject).map(([s, list]) => (
            <div key={s}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{s}</h3>
              <div className="mt-2 grid gap-2">
                {list.map((it) => (
                  <div key={it.id} className={`flex items-center gap-3 rounded-xl border p-3 ${it.done ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
                    <button
                      onClick={() => setItems(items.map((x) => x.id === it.id ? { ...x, done: !x.done } : x))}
                      className={`grid h-7 w-7 place-items-center rounded-lg border ${it.done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                      aria-label="Marquer révisé">
                      {it.done && <Check className="h-4 w-4" />}
                    </button>
                    <div className={`flex-1 text-sm ${it.done ? "line-through text-muted-foreground" : ""}`}>{it.chapter}</div>
                    <button onClick={() => setItems(items.filter((x) => x.id !== it.id))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" aria-label="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}