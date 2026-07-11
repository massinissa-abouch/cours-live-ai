import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getRevisionSheet } from "@/lib/ai-revision.functions";

export const Route = createFileRoute("/_authenticated/ai/sheets/$sheetId")({
  component: SheetView,
});

function SheetView() {
  const { sheetId } = Route.useParams();
  const load = useServerFn(getRevisionSheet);
  const [sheet, setSheet] = useState<{ title: string; content_markdown: string } | null>(null);

  useEffect(() => {
    load({ data: { id: sheetId } }).then((r) => setSheet(r as { title: string; content_markdown: string }));
  }, [sheetId, load]);

  if (!sheet) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/ai/sheets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Toutes les fiches
      </Link>
      <article className="prose prose-invert mt-6 max-w-none rounded-2xl border border-border bg-card p-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{sheet.content_markdown}</ReactMarkdown>
      </article>
    </div>
  );
}
