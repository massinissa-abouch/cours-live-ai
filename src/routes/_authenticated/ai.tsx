import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Sparkles, Plus, MessageSquare, ClipboardList, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  listConversations,
  createConversation,
  deleteConversation,
} from "@/lib/ai-conversations.functions";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "Ostadi IA — Tuteur conversationnel" },
      {
        name: "description",
        content: "Discute avec ton tuteur IA, envoie une photo d'exercice, génère fiches et contrôles alignés sur le programme algérien.",
      },
    ],
  }),
  component: AiLayout,
});

type Conv = { id: string; title: string; subject: string | null; updated_at: string };

function AiLayout() {
  const navigate = useNavigate();
  const list = useServerFn(listConversations);
  const create = useServerFn(createConversation);
  const del = useServerFn(deleteConversation);
  const [convs, setConvs] = useState<Conv[]>([]);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    list().then((d) => setConvs(d as Conv[]));
  }, [list, path]);

  async function onNew() {
    try {
      const { id } = await create({ data: {} });
      navigate({ to: "/ai/c/$conversationId", params: { conversationId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Supprimer cette conversation ?")) return;
    await del({ data: { id } });
    setConvs((prev) => prev.filter((c) => c.id !== id));
    if (path.includes(id)) navigate({ to: "/ai" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl">
        <aside className="hidden w-72 shrink-0 border-r border-border/60 bg-card/30 md:block">
          <div className="sticky top-0 flex h-screen flex-col">
            <div className="border-b border-border/60 p-4">
              <Link to="/dashboard" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                ← Tableau de bord
              </Link>
              <div className="mt-3 flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/30">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Ostadi IA</div>
                  <div className="text-[11px] text-muted-foreground">Tuteur conversationnel</div>
                </div>
              </div>
              <button
                onClick={onNew}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-90">
                <Plus className="h-4 w-4" /> Nouvelle conversation
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  to="/ai/exam/new"
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[11px] font-medium hover:border-primary/40">
                  <ClipboardList className="h-3.5 w-3.5" /> Contrôle
                </Link>
                <Link
                  to="/ai/sheets"
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[11px] font-medium hover:border-primary/40">
                  <BookOpen className="h-3.5 w-3.5" /> Fiches
                </Link>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Historique
              </div>
              {convs.length === 0 && (
                <p className="px-2 text-xs text-muted-foreground">Aucune conversation encore.</p>
              )}
              <ul className="space-y-0.5">
                {convs.map((c) => {
                  const active = path.includes(c.id);
                  return (
                    <li key={c.id} className="group flex items-center">
                      <Link
                        to="/ai/c/$conversationId"
                        params={{ conversationId: c.id }}
                        className={`flex flex-1 items-center gap-2 rounded-lg px-2 py-2 text-xs transition ${
                          active
                            ? "bg-primary/15 text-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}>
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-1 flex-1">{c.title || "Sans titre"}</span>
                      </Link>
                      <button
                        onClick={() => onDelete(c.id)}
                        aria-label="Supprimer"
                        className="mr-1 rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
