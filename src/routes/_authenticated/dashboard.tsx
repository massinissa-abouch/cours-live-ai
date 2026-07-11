import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Video, Sparkles, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const cards = [
    { icon: BookOpen, title: "Catalogue de cours", desc: "Trouve un cours vidéo", to: "/courses" as const },
    { icon: Video, title: "Trouver un prof", desc: "Réserve une session live", to: "/teachers" as const },
    { icon: Sparkles, title: "Entraînement IA", desc: "Génère un exercice", to: "/ai" as const },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">أ</div>
            <span className="font-semibold">Ostadi</span>
          </Link>
          <button onClick={signOut} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary">
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">
          Bonjour {user.user_metadata?.full_name ?? user.email} 👋
        </h1>
        <p className="mt-2 text-muted-foreground">Que veux-tu faire aujourd'hui ?</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <Link
              key={c.title} to={c.to}
              className="group rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
            </Link>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-dashed border-border bg-secondary/50 p-6">
          <p className="text-sm text-muted-foreground">
            Ton tableau de bord se remplira à mesure que tu utilises la plateforme :
            cours en cours, sessions à venir, streak IA, badges…
          </p>
        </div>
      </main>
    </div>
  );
}