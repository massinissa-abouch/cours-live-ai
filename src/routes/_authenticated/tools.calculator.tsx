import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Calculator } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/tools/calculator")({
  component: CalculatorPage,
});

type Subject = { key: string; label: string; coef: number };
type Filiere = { key: string; label: string; subjects: Subject[] };

// Coefficients officiels approximatifs — ONEC (à ajuster si besoin par l'utilisateur)
const BAC_FILIERES: Filiere[] = [
  {
    key: "sciences",
    label: "BAC — Sciences expérimentales",
    subjects: [
      { key: "maths", label: "Mathématiques", coef: 5 },
      { key: "svt", label: "Sciences naturelles (SVT)", coef: 6 },
      { key: "pc", label: "Physique-Chimie", coef: 5 },
      { key: "ar", label: "Arabe", coef: 3 },
      { key: "fr", label: "Français", coef: 2 },
      { key: "en", label: "Anglais", coef: 2 },
      { key: "philo", label: "Philosophie", coef: 2 },
      { key: "hg", label: "Histoire-Géographie", coef: 2 },
      { key: "islam", label: "Éducation islamique", coef: 2 },
      { key: "eps", label: "EPS", coef: 1 },
    ],
  },
  {
    key: "maths",
    label: "BAC — Mathématiques",
    subjects: [
      { key: "maths", label: "Mathématiques", coef: 7 },
      { key: "pc", label: "Physique-Chimie", coef: 6 },
      { key: "svt", label: "Sciences naturelles", coef: 2 },
      { key: "ar", label: "Arabe", coef: 2 },
      { key: "fr", label: "Français", coef: 2 },
      { key: "en", label: "Anglais", coef: 2 },
      { key: "philo", label: "Philosophie", coef: 2 },
      { key: "hg", label: "Histoire-Géographie", coef: 2 },
      { key: "islam", label: "Éducation islamique", coef: 2 },
      { key: "eps", label: "EPS", coef: 1 },
    ],
  },
  {
    key: "techmath",
    label: "BAC — Techniques mathématiques",
    subjects: [
      { key: "maths", label: "Mathématiques", coef: 6 },
      { key: "tech", label: "Technologie (spé.)", coef: 6 },
      { key: "pc", label: "Physique-Chimie", coef: 4 },
      { key: "ar", label: "Arabe", coef: 2 },
      { key: "fr", label: "Français", coef: 2 },
      { key: "en", label: "Anglais", coef: 2 },
      { key: "philo", label: "Philosophie", coef: 2 },
      { key: "hg", label: "Histoire-Géographie", coef: 2 },
      { key: "islam", label: "Éducation islamique", coef: 2 },
      { key: "eps", label: "EPS", coef: 1 },
    ],
  },
  {
    key: "lettres",
    label: "BAC — Lettres et philosophie",
    subjects: [
      { key: "ar", label: "Arabe", coef: 6 },
      { key: "philo", label: "Philosophie", coef: 6 },
      { key: "hg", label: "Histoire-Géographie", coef: 4 },
      { key: "fr", label: "Français", coef: 3 },
      { key: "en", label: "Anglais", coef: 3 },
      { key: "islam", label: "Éducation islamique", coef: 2 },
      { key: "maths", label: "Mathématiques", coef: 2 },
      { key: "eps", label: "EPS", coef: 1 },
    ],
  },
  {
    key: "langues",
    label: "BAC — Langues étrangères",
    subjects: [
      { key: "ar", label: "Arabe", coef: 5 },
      { key: "fr", label: "Français", coef: 5 },
      { key: "en", label: "Anglais", coef: 5 },
      { key: "lv3", label: "Langue vivante 3 (Esp/All/It)", coef: 4 },
      { key: "philo", label: "Philosophie", coef: 2 },
      { key: "hg", label: "Histoire-Géographie", coef: 2 },
      { key: "maths", label: "Mathématiques", coef: 2 },
      { key: "islam", label: "Éducation islamique", coef: 2 },
      { key: "eps", label: "EPS", coef: 1 },
    ],
  },
  {
    key: "gestion",
    label: "BAC — Gestion et économie",
    subjects: [
      { key: "ge", label: "Gestion comptable et financière", coef: 6 },
      { key: "eco", label: "Économie / Droit", coef: 5 },
      { key: "maths", label: "Mathématiques", coef: 3 },
      { key: "hg", label: "Histoire-Géographie", coef: 3 },
      { key: "ar", label: "Arabe", coef: 3 },
      { key: "fr", label: "Français", coef: 2 },
      { key: "en", label: "Anglais", coef: 2 },
      { key: "philo", label: "Philosophie", coef: 2 },
      { key: "islam", label: "Éducation islamique", coef: 2 },
      { key: "eps", label: "EPS", coef: 1 },
    ],
  },
];

const BEM_FILIERE: Filiere = {
  key: "bem",
  label: "BEM — 4ème année moyenne",
  subjects: [
    { key: "ar", label: "Arabe", coef: 5 },
    { key: "maths", label: "Mathématiques", coef: 4 },
    { key: "fr", label: "Français", coef: 3 },
    { key: "pc", label: "Physique-Chimie", coef: 2 },
    { key: "svt", label: "Sciences naturelles (SVT)", coef: 2 },
    { key: "hg", label: "Histoire-Géographie", coef: 2 },
    { key: "islam", label: "Éducation islamique", coef: 2 },
    { key: "en", label: "Anglais", coef: 2 },
    { key: "amz", label: "Tamazight", coef: 1 },
    { key: "eps", label: "EPS", coef: 1 },
  ],
};

function CalculatorPage() {
  const [exam, setExam] = useState<"bac" | "bem">("bac");
  const [filiereKey, setFiliereKey] = useState<string>("sciences");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const filiere = useMemo(
    () => (exam === "bem" ? BEM_FILIERE : BAC_FILIERES.find((f) => f.key === filiereKey) ?? BAC_FILIERES[0]),
    [exam, filiereKey],
  );

  const { moyenne, totalCoef, mention } = useMemo(() => {
    let sum = 0;
    let coefSum = 0;
    for (const s of filiere.subjects) {
      const raw = notes[s.key];
      if (raw === undefined || raw === "") continue;
      const n = Number(raw.replace(",", "."));
      if (Number.isFinite(n) && n >= 0 && n <= 20) {
        sum += n * s.coef;
        coefSum += s.coef;
      }
    }
    const m = coefSum > 0 ? sum / coefSum : 0;
    let mention = "—";
    if (coefSum > 0) {
      if (m >= 16) mention = "Très bien";
      else if (m >= 14) mention = "Bien";
      else if (m >= 12) mention = "Assez bien";
      else if (m >= 10) mention = "Passable";
      else mention = "Insuffisant";
    }
    return { moyenne: m, totalCoef: coefSum, mention };
  }, [notes, filiere]);

  const passing = moyenne >= 10 && totalCoef > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <Link to="/tools" className="rounded-lg p-2 hover:bg-secondary" aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Calculator className="h-4 w-4 text-primary" />
          <div className="font-semibold">Calculateur de moyenne</div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap gap-2">
          {(["bac", "bem"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setExam(v)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                exam === v ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"
              }`}
            >
              {v === "bac" ? "BAC" : "BEM"}
            </button>
          ))}
        </div>

        {exam === "bac" && (
          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filière</label>
            <select
              value={filiereKey}
              onChange={(e) => setFiliereKey(e.target.value)}
              className="mt-1 w-full max-w-md rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              {BAC_FILIERES.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {filiere.subjects.map((s) => (
            <div key={s.key} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground">Coefficient {s.coef}</div>
              </div>
              <input
                inputMode="decimal"
                placeholder="0-20"
                value={notes[s.key] ?? ""}
                onChange={(e) => setNotes({ ...notes, [s.key]: e.target.value })}
                className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm"
              />
            </div>
          ))}
        </div>

        <div className={`sticky bottom-4 mt-8 rounded-2xl border p-5 shadow-[var(--shadow-lift)] ${
          passing ? "border-primary/40 bg-primary/5" : "border-border bg-card"
        }`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Moyenne calculée</div>
              <div className="mt-1 text-4xl font-bold">
                {totalCoef > 0 ? moyenne.toFixed(2) : "—"}
                <span className="text-lg text-muted-foreground">/20</span>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-semibold ${passing ? "text-primary" : "text-muted-foreground"}`}>
                {mention}
              </div>
              <div className="text-xs text-muted-foreground">Coefficients renseignés : {totalCoef}</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Coefficients officiels approximatifs (ONEC). Les matières laissées vides sont ignorées.
          </p>
        </div>
      </main>
    </div>
  );
}