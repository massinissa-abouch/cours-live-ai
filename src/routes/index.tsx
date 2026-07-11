import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Video, Sparkles, ShieldCheck, Clock, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <Pillars />
      <HowItWorks />
      <Trust />
      <Footer />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">أ</div>
          <span className="text-lg font-semibold tracking-tight">Ostadi</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link to="/courses" className="hover:text-primary">Cours</Link>
          <Link to="/teachers" className="hover:text-primary">Profs en direct</Link>
          <Link to="/ai" className="hover:text-primary">Entraînement IA</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary">Se connecter</Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-90"
          >
            Commencer
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-90"
        style={{ background: "var(--gradient-hero)" }}
        aria-hidden
      />
      <div className="mx-auto max-w-6xl px-4 py-20 text-primary-foreground md:py-28">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" /> Programme algérien officiel · BEM · BAC · Université
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          Réussir l'école en Algérie, à ton rythme.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-white/90">
          Cours vidéo par des profs vérifiés, tutorat en direct en tête-à-tête ou petit groupe,
          et une IA d'entraînement calée sur ton chapitre exact.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-xl bg-accent px-6 py-3 text-base font-semibold text-accent-foreground shadow-[var(--shadow-lift)] hover:brightness-105"
          >
            Créer un compte gratuit
          </Link>
          <Link
            to="/courses"
            className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur hover:bg-white/20"
          >
            Explorer les cours
          </Link>
        </div>
        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/85">
          <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Profs vérifiés</span>
          <span className="flex items-center gap-2"><Video className="h-4 w-4" /> Vidéo trailer gratuite</span>
          <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> Paiement libéré après la session</span>
        </div>
      </div>
    </section>
  );
}

function Pillars() {
  const items = [
    {
      icon: GraduationCap,
      title: "Marketplace de cours",
      body: "Séries vidéo organisées par matière et niveau, avec un trailer gratuit avant tout achat.",
      href: "/courses",
    },
    {
      icon: Users,
      title: "Tutorat en direct",
      body: "Réserve un prof en tête-à-tête ou en petit groupe (max 5). Quiz live et tableau partagé.",
      href: "/teachers",
    },
    {
      icon: Sparkles,
      title: "Entraînement IA",
      body: "Envoie un sujet en photo — l'IA génère un exercice similaire, plus corsé, avec correction.",
      href: "/ai",
    },
  ] as const;
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Trois manières d'apprendre. Une seule app.</h2>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {items.map((it) => (
          <Link
            key={it.title}
            to={it.href}
            className="group rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
          >
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">
              <it.icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold">{it.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{it.body}</p>
            <span className="mt-4 inline-block text-sm font-medium text-primary group-hover:underline">Découvrir →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: 1, t: "Choisis ton niveau", d: "Du primaire à l'université, filière incluse." },
    { n: 2, t: "Apprends", d: "Vidéos, live, ou entraînement IA — au choix." },
    { n: 3, t: "Progresse", d: "Streaks, badges et compte à rebours examens." },
  ];
  return (
    <section className="border-y border-border" style={{ background: "var(--gradient-warm)" }}>
      <div className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Comment ça marche</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl bg-card p-6 shadow-[var(--shadow-soft)]">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-foreground font-bold">
                {s.n}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="rounded-3xl bg-primary p-10 text-primary-foreground shadow-[var(--shadow-lift)] md:p-14">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Tu es prof ?</h2>
        <p className="mt-3 max-w-2xl text-white/90">
          Publie tes séries, ouvre des créneaux en direct, et sois payé après chaque session.
          Vérification d'identité et de diplôme incluses pour bâtir la confiance.
        </p>
        <Link
          to="/auth"
          search={{ mode: "signup", role: "teacher" }}
          className="mt-6 inline-block rounded-xl bg-accent px-6 py-3 font-semibold text-accent-foreground hover:brightness-105"
        >
          Devenir prof sur Ostadi
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 md:flex-row">
        <p>© {new Date().getFullYear()} Ostadi · Fait en Algérie 🇩🇿</p>
        <div className="flex gap-6">
          <Link to="/">Accueil</Link>
          <Link to="/courses">Cours</Link>
          <Link to="/teachers">Profs</Link>
        </div>
      </div>
    </footer>
  );
}