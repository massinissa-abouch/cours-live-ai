import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send, ImagePlus, Lightbulb, RotateCw, FileText, X } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import {
  getConversation,
  sendChatMessage,
  signAiUpload,
  signAiRead,
} from "@/lib/ai-conversations.functions";
import { generateRevisionSheet } from "@/lib/ai-revision.functions";

export const Route = createFileRoute("/_authenticated/ai/c/")({
  component: ChatPage,
});

type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  image_url: string | null;
  hint_level: number | null;
  signedImage?: string;
};

function ChatPage() {
  const { conversationId } = Route.useParams();
  const get = useServerFn(getConversation);
  const send = useServerFn(sendChatMessage);
  const sign = useServerFn(signAiUpload);
  const read = useServerFn(signAiRead);
  const genSheet = useServerFn(generateRevisionSheet);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [meta, setMeta] = useState<{ subject: string | null; level: string | null; chapter: string | null; title: string } | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<{ path: string; preview: string } | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setInitialLoad(true);
    setMessages([]);
    get({ data: { id: conversationId } })
      .then(async (res) => {
        setMeta({ ...res.conversation, title: (res.conversation as { title?: string }).title ?? "" });
        const msgs = res.messages as Msg[];
        // Resolve signed URLs for images
        const withUrls = await Promise.all(
          msgs.map(async (m) => {
            if (m.image_url) {
              try {
                const { signedUrl } = await read({ data: { path: m.image_url } });
                return { ...m, signedImage: signedUrl };
              } catch {
                return m;
              }
            }
            return m;
          })
        );
        setMessages(withUrls);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erreur"))
      .finally(() => {
        setInitialLoad(false);
        setTimeout(() => textRef.current?.focus(), 50);
      });
  }, [conversationId, get, read]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function onPickImage(file: File | null) {
    if (!file) return;
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const { path, token } = await sign({ data: { ext } });
      const { error } = await supabase.storage
        .from("ai-uploads")
        .uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw error;
      const preview = URL.createObjectURL(file);
      setImage({ path, preview });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload échoué");
    }
  }

  async function submit(opts?: { mode?: "chat" | "hint" | "harder"; hintLevel?: number; overrideContent?: string }) {
    const mode = opts?.mode ?? "chat";
    const content = opts?.overrideContent ?? input.trim();
    if (!content && !image) return;
    if (loading) return;

    const userMsg: Msg = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: content || (image ? "(photo envoyée)" : ""),
      image_url: image?.path ?? null,
      hint_level: null,
      signedImage: image?.preview,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const sentImage = image;
    setImage(null);
    setLoading(true);
    setShowHints(false);

    try {
      const res = await send({
        data: {
          conversationId,
          userMessage: {
            content: userMsg.content,
            image_url: sentImage?.path,
          },
          mode,
          hintLevel: opts?.hintLevel,
        },
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-a-${Date.now()}`,
          role: "assistant",
          content: res.reply,
          image_url: null,
          hint_level: opts?.hintLevel ?? null,
        },
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur IA");
      setMessages((prev) => prev.slice(0, -1));
      setInput(content);
    } finally {
      setLoading(false);
      setTimeout(() => textRef.current?.focus(), 50);
    }
  }

  async function onGenSheet() {
    if (messages.length < 2) {
      toast.error("Discute au moins un peu avant de générer une fiche.");
      return;
    }
    toast.info("Génération de la fiche…");
    try {
      const { id } = await genSheet({ data: { conversationId } });
      toast.success("Fiche générée");
      window.location.href = `/ai/sheets/${id}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border/60 bg-background/60 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <div className="line-clamp-1 text-sm font-semibold">{meta?.title || "Conversation"}</div>
          <div className="text-[11px] text-muted-foreground">
            {meta?.subject ?? "Aucune matière"} · {meta?.level ?? "—"}
          </div>
        </div>
        <button
          onClick={onGenSheet}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs hover:border-primary/50">
          <FileText className="h-3.5 w-3.5" /> Fiche de révision
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          {initialLoad && (
            <div className="py-20 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          )}
          {!initialLoad && messages.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-center text-sm text-muted-foreground">
              Envoie ta première question ou une photo d'exercice pour démarrer.
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </span>
              Ostadi réfléchit…
            </div>
          )}
        </div>
      </div>

      {showHints && (
        <div className="border-t border-border/60 bg-card/40 px-4 py-3">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Indice :</span>
            <button
              onClick={() => submit({ mode: "hint", hintLevel: 1, overrideContent: "Donne-moi un indice léger sans dévoiler la méthode." })}
              className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/25">
              💡 Léger
            </button>
            <button
              onClick={() => submit({ mode: "hint", hintLevel: 2, overrideContent: "Donne-moi un indice détaillé (méthode + formules) mais pas la réponse." })}
              className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/25">
              💡💡 Détaillé
            </button>
            <button
              onClick={() => submit({ mode: "hint", hintLevel: 3, overrideContent: "Donne-moi la solution complète étape par étape." })}
              className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/25">
              💡💡💡 Solution
            </button>
            <button
              onClick={() => setShowHints(false)}
              className="ml-auto rounded p-1 text-muted-foreground hover:bg-secondary">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-t border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          {image && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
              <img src={image.preview} alt="" className="h-8 w-8 rounded object-cover" />
              <span>Photo prête à envoyer</span>
              <button
                type="button"
                onClick={() => setImage(null)}
                className="ml-1 rounded p-0.5 hover:bg-secondary">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-input bg-card/80 p-2 focus-within:border-primary/60">
            <label className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-primary">
              <ImagePlus className="h-4 w-4" />
              <input type="file" accept="image/*" hidden onChange={(e) => onPickImage(e.target.files?.[0] ?? null)} />
            </label>
            <button
              type="button"
              onClick={() => setShowHints((s) => !s)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-primary"
              title="Demander un indice progressif">
              <Lightbulb className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => submit({ mode: "harder", overrideContent: "Génère-moi un exercice similaire mais plus complexe." })}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-primary"
              title="Similaire mais + difficile">
              <RotateCw className="h-4 w-4" />
            </button>
            <textarea
              ref={textRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Pose ta question à Ostadi…"
              className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || (!input.trim() && !image)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[92%] ${isUser ? "" : "w-full"}`}>
        {msg.signedImage && (
          <img src={msg.signedImage} alt="pièce jointe" className="mb-2 max-h-64 rounded-xl object-contain" />
        )}
        {isUser ? (
          <div className="rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground">
            {msg.content}
          </div>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none text-foreground">
            {msg.hint_level && (
              <div className="mb-2 inline-block rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                Indice niveau {msg.hint_level}
              </div>
            )}
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
