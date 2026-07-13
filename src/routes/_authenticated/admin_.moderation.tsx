import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, ShieldAlert, EyeOff, X, Trash2, Ban } from "lucide-react";
import { listReports, resolveReport, banUser } from "@/lib/community.functions";

export const Route = createFileRoute("/_authenticated/admin_/moderation")({
  component: ModerationPage,
});

type Report = Awaited<ReturnType<typeof listReports>>[number];

function ModerationPage() {
  const load = useServerFn(listReports);
  const resolve = useServerFn(resolveReport);
  const ban = useServerFn(banUser);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");

  async function refresh() {
    try { setReports(await load()); } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Link to="/admin" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Admin</Link>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      </div>
    );
  }

  const open = reports.filter((r) => r.status === "open");
  const closed = reports.filter((r) => r.status !== "open");

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <Link to="/admin" className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Modération</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{open.length} signalement{open.length > 1 ? "s" : ""} en attente</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">À traiter</h2>
        {open.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground text-center">Aucun signalement en attente.</div>
        ) : open.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground">
                  {r.target_type === "thread" ? "Fil" : "Réponse"} · signalé le {new Date(r.created_at).toLocaleString("fr-FR")}
                </div>
                <div className="mt-1 text-sm"><span className="font-semibold">Raison :</span> {r.reason}</div>
                <div className="mt-1 text-xs font-mono text-muted-foreground">ID : {r.target_id}</div>
                <div className="text-xs font-mono text-muted-foreground">Signaleur : {r.reporter_id}</div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button onClick={async () => { await resolve({ data: { id: r.id, action: "hide" } }); refresh(); }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">
                  <EyeOff className="h-3.5 w-3.5" /> Cacher
                </button>
                <button onClick={async () => { if (confirm("Supprimer définitivement ?")) { await resolve({ data: { id: r.id, action: "delete" } }); refresh(); } }}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/20">
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </button>
                <button onClick={async () => { await resolve({ data: { id: r.id, action: "dismiss" } }); refresh(); }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary">
                  <X className="h-3.5 w-3.5" /> Rejeter
                </button>
                <button onClick={async () => {
                  const uid = prompt("ID utilisateur à bannir (copie l'ID auteur depuis le contenu) :");
                  if (!uid) return;
                  const days = Number(prompt("Durée en jours ?", "7"));
                  if (!days || days < 1) return;
                  const reason = prompt("Raison ?") ?? undefined;
                  try { await ban({ data: { userId: uid.trim(), days, reason } }); alert("Banni."); }
                  catch (e) { alert((e as Error).message); }
                }}
                  className="inline-flex items-center gap-1 rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-600 hover:bg-orange-500/20">
                  <Ban className="h-3.5 w-3.5" /> Bannir
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {closed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-2">Historique récent</h2>
          <div className="space-y-1">
            {closed.slice(0, 30).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 p-2 text-xs">
                <span>{r.target_type} — {r.reason.slice(0, 80)}</span>
                <span className={`rounded-md px-2 py-0.5 ${r.status === "dismissed" ? "bg-secondary" : "bg-primary/10 text-primary"}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}