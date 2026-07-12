import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, TrendingUp, Zap, ArrowLeft } from "lucide-react";
import { getAiCostSummary } from "@/lib/ai-cost.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Summary = Awaited<ReturnType<typeof getAiCostSummary>>;

function AdminPage() {
  const load = useServerFn(getAiCostSummary);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load()
      .then((d) => setData(d as Summary))
      .catch((e: Error) => setError(e.message));
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Link to="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Accès refusé : cette page est réservée aux administrateurs.
        </div>
      </div>
    );
  }
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;

  const pct = Math.min(100, (data.monthTotal / data.budget) * 100);
  const barColor = data.overBudget ? "bg-destructive" : data.overAlert ? "bg-orange-500" : "bg-primary";
  const modelRows = Object.entries(data.byModel).sort((a, b) => b[1].cost - a[1].cost);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <Link to="/dashboard" className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Administration — Coût IA</h1>
        <p className="text-sm text-muted-foreground">
          Période : mois en cours (depuis le {new Date(data.periodStart).toLocaleDateString("fr-FR")}).
        </p>
      </div>

      {data.overAlert && (
        <div
          className={`flex items-start gap-3 rounded-lg border p-4 ${
            data.overBudget
              ? "border-destructive bg-destructive/10 text-destructive"
              : "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm">
            <div className="font-semibold">
              {data.overBudget
                ? `Budget dépassé : ${data.monthTotal.toFixed(2)} € / ${data.budget} €`
                : `Seuil d'alerte franchi : ${data.monthTotal.toFixed(2)} € / ${data.budget} € (alerte à ${data.alertThreshold} €)`}
            </div>
            <div className="mt-1 opacity-90">
              Envisage de basculer temporairement tout le trafic sur le modèle rapide, ou d'augmenter les seuils déclenchant le modèle puissant.
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <TrendingUp className="h-4 w-4" /> Coût du mois
          </div>
          <div className="mt-2 text-3xl font-bold">{data.monthTotal.toFixed(2)} €</div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {pct.toFixed(1)} % du budget {data.budget} € • alerte à {data.alertThreshold} €
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <Zap className="h-4 w-4" /> Requêtes
          </div>
          <div className="mt-2 text-3xl font-bold">{data.requests}</div>
          <div className="mt-1 text-xs text-muted-foreground">appels IA ce mois</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Coût moyen / requête</div>
          <div className="mt-2 text-3xl font-bold">
            {data.requests ? (data.monthTotal / data.requests).toFixed(4) : "0"} €
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b p-4 font-semibold">Par modèle</div>
        <div className="divide-y">
          {modelRows.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Aucune donnée pour ce mois.</div>
          )}
          {modelRows.map(([m, s]) => (
            <div key={m} className="grid grid-cols-2 gap-2 p-4 text-sm md:grid-cols-5">
              <div className="col-span-2 font-mono">{m}</div>
              <div>{s.requests} req.</div>
              <div className="text-muted-foreground">
                {s.inTokens.toLocaleString("fr-FR")} in / {s.outTokens.toLocaleString("fr-FR")} out
              </div>
              <div className="text-right font-semibold">{s.cost.toFixed(4)} €</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b p-4 font-semibold">Par jour</div>
        <div className="divide-y">
          {Object.entries(data.byDay)
            .sort((a, b) => (a[0] < b[0] ? 1 : -1))
            .map(([d, c]) => (
              <div key={d} className="flex items-center justify-between p-3 text-sm">
                <span>{new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" })}</span>
                <span className="font-semibold">{c.toFixed(4)} €</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}