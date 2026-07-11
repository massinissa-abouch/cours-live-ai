import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, MessageSquare, Camera, Lightbulb, ClipboardList, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { createConversation } from "@/lib/ai-conversations.functions";

export const Route = createFileRoute("/_authenticated/ai/")({
  component: AiHome,
});

function AiHome() {
  const navigate = useNavigate();
  const create = useServerFn(createConversation);

  async function startWith(subject?: string, level?: string) {
    try {
      const { id } = await create({ data: { subject, level } });
      navigate({ to: "/ai/c/$conversationId", params: { conversationId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  const suggestions = [
    { label: "Maths — 3AS Sciences", subject: "Mathématiques", level: "lycee_3_sciences" },
    { label: "Physique-Chimie — 3AS", subject: "Physique-Chimie", level: "lycee_3_sciences" },
    { label: "SVT — 3AS", subject: "Sciences Naturelles", level: "lycee_3_sciences" },
    { label: "Français — 4AM (BEM)", subject: "Français", level: "cem_4" },
    { label: "Arabe — 3AS Lettres", subject: "Arabe", level: "lycee_3_lettres" },
    { label: "Anglais — 3AS", subject: "Anglais", level: "lycee_3_sciences" },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16">
      <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-primary/30 to-accent/20 text-primary ring-1 ring-primary/40">
        <Sparkles className="h-8 w-8" />
      </div>
      <h1 className="mt-6 text-center text-4xl font-bold tracking-tight">
        Salut 👋 Prêt à réviser ?
      </h1>
      <p className="mt-3 text-center text-muted-foreground">
        Discute avec Ostadi, envoie une photo d'exercice, demande un indice progressif, ou prépare-toi à un contrôle.
      </p>

      <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
        <Feature icon={<MessageSquare className="h-4 w-4" />} title="Conversation naturelle" desc="Ostadi garde le contexte, tu peux enchaîner les questions." />
        <Feature icon={<Camera className="h-4 w-4" />} title="Photo d'exercice" desc="Prends en photo un sujet, l'IA le comprend et te génère un similaire." />
        <Feature icon={<Lightbulb className="h-4 w-4" />} title="Indices progressifs" desc="Léger → détaillé → solution. À ton rythme, sans spoiler." />
      </div>

      <button
        onClick={() => startWith()}
        className="mt-8 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-lift)] hover:opacity-90">
        Nouvelle conversation
      </button>

      <div className="mt-8 w-full">
        <div className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ou démarre sur une matière
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button
              key={s.label}
              onClick={() => startWith(s.subject, s.level)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:border-primary/50 hover:text-primary">
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid w-full gap-3 sm:grid-cols-2">
        <button
          onClick={() => navigate({ to: "/ai/exam/new" })}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">Prépare-moi un contrôle</div>
            <div className="text-xs text-muted-foreground">Mini-examen chronométré avec correction IA.</div>
          </div>
        </button>
        <button
          onClick={() => navigate({ to: "/ai/sheets" })}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">Mes fiches de révision</div>
            <div className="text-xs text-muted-foreground">Générées automatiquement à partir de tes sessions IA.</div>
          </div>
        </button>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div className="mt-3 text-sm font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
