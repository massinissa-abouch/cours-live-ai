import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/teachers")({
  head: () => ({
    meta: [
      { title: "Profs en direct — Ostadi" },
      { name: "description", content: "Trouve un prof pour une session en tête-à-tête ou en petit groupe." },
    ],
  }),
  component: Teachers,
});

function Teachers() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Link to="/" className="flex items-center gap-2 text-sm hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Accueil
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Profs disponibles en direct</h1>
        <p className="mt-2 text-muted-foreground">
          La recherche de prof arrive bientôt : filtres par matière, niveau, prix/heure, disponibilité, note.
        </p>
      </main>
    </div>
  );
}