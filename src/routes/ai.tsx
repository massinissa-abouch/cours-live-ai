import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "Entraînement IA — Ostadi" },
      { name: "description", content: "Génère des exercices alignés sur le programme algérien et fais-toi corriger par l'IA." },
    ],
  }),
  component: AI,
});

function AI() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Link to="/" className="flex items-center gap-2 text-sm hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Accueil
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-14">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <Sparkles className="h-7 w-7" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Entraînement IA</h1>
        <p className="mt-2 text-muted-foreground">
          Envoie une photo de ton sujet — l'IA te génère un exercice similaire mais plus corsé,
          puis corrige ta réponse. Aligné sur le programme BEM / BAC.
        </p>
        <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Module en construction. Bientôt disponible.
        </div>
      </main>
    </div>
  );
}