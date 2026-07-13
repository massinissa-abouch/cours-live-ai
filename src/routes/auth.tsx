import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

type Search = { mode?: "signin" | "signup"; role?: "student" | "teacher" | "parent"; ref?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s.mode === "signup" ? "signup" : "signin",
    role: s.role === "teacher" || s.role === "parent" ? s.role : "student",
    ref: typeof s.ref === "string" && s.ref.length >= 4 && s.ref.length <= 32 ? s.ref : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initialMode, ref } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(ref ? "signup" : (initialMode ?? "signin"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  useEffect(() => {
    if (ref && typeof window !== "undefined") {
      window.localStorage.setItem("ostadi_ref", ref);
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate, ref]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Compte créé !");
          navigate({ to: "/onboarding" });
        } else {
          setAwaitingConfirm(true);
          toast.success("Vérifie ta boîte mail pour confirmer ton compte.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error("Erreur Google");
    if (!res.redirected) navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">أ</div>
          <span className="text-lg font-semibold">Ostadi</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          {awaitingConfirm ? (
            <>
              <h1 className="text-2xl font-bold">Confirme ton email 📩</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                On vient d'envoyer un lien de vérification à <b>{email}</b>. Clique dessus pour activer ton compte, puis reviens te connecter.
              </p>
              <button onClick={() => { setAwaitingConfirm(false); setMode("signin"); }}
                className="mt-6 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground">
                J'ai confirmé, se connecter
              </button>
            </>
          ) : (
          <>
          <h1 className="text-2xl font-bold">
            {mode === "signup" ? "Créer un compte" : "Bon retour !"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? "Rejoins des milliers d'élèves algériens." : "Reprends là où tu t'es arrêté."}
          </p>

          <button
            onClick={handleGoogle}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-secondary"
          >
            Continuer avec Google
          </button>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nom complet"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
              />
            )}
            <input
              required type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
            />
            <input
              required type="password" value={password} minLength={6}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
            />
            <button
              type="submit" disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "..." : mode === "signup" ? "Créer mon compte" : "Se connecter"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
            <button
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="font-medium text-primary hover:underline"
            >
              {mode === "signup" ? "Se connecter" : "S'inscrire"}
            </button>
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  );
}