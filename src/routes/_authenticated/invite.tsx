import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getGrowthStatus } from "@/lib/growth.functions";
import { Copy, Share2, Users, Sparkles, Gift, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invite")({
  component: InvitePage,
});

function InvitePage() {
  const load = useServerFn(getGrowthStatus);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getGrowthStatus>> | null>(null);

  useEffect(() => { load().then(setStatus); }, [load]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = status?.referralCode ? `${origin}/auth?ref=${status.referralCode}` : "";
  const remaining = Math.max(0, 3 - (status?.acceptedCount ?? 0));
  const perkDaysLeft = status?.perkUnlockedUntil
    ? Math.max(0, Math.ceil((new Date(status.perkUnlockedUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  async function copy() {
    await navigator.clipboard.writeText(link);
    toast.success("Lien copié !");
  }
  async function share() {
    if (!link) return;
    const text = `Rejoins-moi sur Ostadi, le tuteur IA des élèves algériens 🇩🇿 ${link}`;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) { try { await nav.share({ title: "Ostadi", text, url: link }); return; } catch { /* ignore */ } }
    await navigator.clipboard.writeText(text);
    toast.success("Message copié !");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>

        <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-[var(--shadow-lift)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
            <Gift className="h-3.5 w-3.5" /> Programme parrainage
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Invite 3 camarades, gagne 7 jours d'accès illimité
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Chaque ami qui s'inscrit avec ton lien débloque des jours de chat IA et d'archive Bac & BEM en illimité.
          </p>

          {status?.perkActive && (
            <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              🎉 Accès illimité actif — encore <b>{perkDaysLeft} jour{perkDaysLeft > 1 ? "s" : ""}</b>.
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-border bg-background p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Ton lien de parrainage</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-secondary px-3 py-2 text-sm">{link || "…"}</code>
              <button onClick={copy} disabled={!link} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-secondary disabled:opacity-50">
                <Copy className="h-3.5 w-3.5" /> Copier
              </button>
              <button onClick={share} disabled={!link} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                <Share2 className="h-3.5 w-3.5" /> Partager
              </button>
            </div>
            {status?.referralCode && (
              <div className="mt-3 text-xs text-muted-foreground">
                Code : <span className="font-mono font-semibold text-foreground">{status.referralCode}</span>
              </div>
            )}
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold inline-flex items-center gap-1"><Users className="h-4 w-4" /> Progression</span>
              <span className="text-muted-foreground">{status?.acceptedCount ?? 0} / 3</span>
            </div>
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`h-3 flex-1 rounded-full ${i < (status?.acceptedCount ?? 0) ? "bg-primary" : "bg-secondary"}`} />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {remaining > 0
                ? `Encore ${remaining} inscription${remaining > 1 ? "s" : ""} pour débloquer +7 jours.`
                : "Cycle complet — continue à inviter pour cumuler des jours supplémentaires !"}
            </p>
            {(status?.rewardedCount ?? 0) > 0 && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> {status!.rewardedCount} filleul{status!.rewardedCount > 1 ? "s" : ""} déjà récompensé{status!.rewardedCount > 1 ? "s" : ""}.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <b className="text-foreground">Comment ça marche ?</b>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Envoie ton lien à 3 amis (WhatsApp, Insta, story…).</li>
            <li>Ils créent un compte et confirment leur email.</li>
            <li>Dès le 3e, tu débloques 7 jours d'accès illimité au chat IA et à l'archive.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}