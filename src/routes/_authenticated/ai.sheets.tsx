import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { listRevisionSheets } from "@/lib/ai-revision.functions";

export const Route = createFileRoute("/_authenticated/ai/sheets")({
  component: SheetsList,
});

type Sheet = { id: string; title: string; subject: string | null; chapter: string | null; created_at: string };

function SheetsList() {
  const load = useServerFn(listRevisionSheets);
  const [sheets, setSheets] = useState<Sheet[] | null>(null);

  useEffect(() => {
    load().then((d) => setSheets(d as Sheet[]));
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mes fiches de révision</h1>
          <p className="text-sm text-muted-foreground">Générées automatiquement à partir de tes sessions IA.</p>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {sheets === null && <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />}
        {sheets && sheets.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-center text-sm text-muted-foreground">
            Termine une conversation IA et clique sur « Fiche de révision » pour en créer une.
          </div>
        )}
        {sheets?.map((s) => (
          <Link
            key={s.id}
            to="/ai/sheets/$sheetId"
            params={{ sheetId: s.id }}
            className="block rounded-2xl border border-border bg-card p-4 hover:border-primary/50">
            <div className="text-xs text-muted-foreground">
              {s.subject ?? "—"} {s.chapter ? `· ${s.chapter}` : ""}
            </div>
            <div className="mt-1 font-semibold">{s.title}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{new Date(s.created_at).toLocaleString("fr-FR")}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
