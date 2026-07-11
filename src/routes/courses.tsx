import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/courses")({
  head: () => ({
    meta: [
      { title: "Cours — Ostadi" },
      { name: "description", content: "Catalogue de cours vidéo par des profs vérifiés, alignés sur le programme algérien." },
    ],
  }),
  component: Courses,
});

function Courses() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 text-sm hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Accueil
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Catalogue de cours</h1>
        <p className="mt-2 text-muted-foreground">
          Le catalogue arrive bientôt : filtres par matière, niveau, prix, note et langue.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
              <div className="aspect-video rounded-xl bg-secondary" />
              <div className="mt-3 h-4 w-3/4 rounded bg-secondary" />
              <div className="mt-2 h-3 w-1/2 rounded bg-secondary" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}