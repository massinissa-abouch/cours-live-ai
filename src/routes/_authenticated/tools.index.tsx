import { createFileRoute, Link } from "@tanstack/react-router";
import { Calculator, Timer, BookOpenCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tools/")({
  component: ToolsHub,
});

function ToolsHub() {
  const tools = [
    {
      to: "/tools/calculator" as const,
      icon: Calculator,
      title: "Calculateur de moyenne",
      desc: "BEM et BAC — coefficients officiels par filière algérienne.",
    },
    {
      to: "/tools/countdown" as const,
      icon: Timer,
      title: "Compte à rebours examen",
      desc: "Jours restants avant ton BEM ou BAC + checklist des chapitres.",
    },
    {
      to: "/tools/exercises" as const,
      icon: BookOpenCheck,
      title: "Banque d'exercices",
      desc: "Génère un exercice par chapitre, corrigé instantanément.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <Link to="/dashboard" className="rounded-lg p-2 hover:bg-secondary" aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="font-semibold">Outils élève</div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Tes outils de révision</h1>
        <p className="mt-2 text-muted-foreground">Des outils simples, gratuits, alignés sur le programme algérien.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {tools.map((t) => (
            <Link
              key={t.title}
              to={t.to}
              className="group rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">
                <t.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{t.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}