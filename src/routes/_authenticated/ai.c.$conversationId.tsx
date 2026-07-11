import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, ImagePlus, Lightbulb, RotateCw, FileText, X, StopCircle } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { getConversation, signAiUpload, signAiRead } from "@/lib/ai-conversations.functions";
import { generateRevisionSheet } from "@/lib/ai-revision.functions";

export const Route = createFileRoute("/_authenticated/ai/c/$conversationId")({
  component: ChatPage,
});

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url: string | null;
  hint_level: number | null;
  signedImage?: string;
  streaming?: boolean;
};

type ConvMeta = {
  id: string;
  title: string;
  subject: string | null;
  level: string | null;
  chapter: string | null;
};

function ChatPage() {
  const { conversationId } = Route.useParams();
  const get = useServerFn(getConversation);
  const sign = useServerFn(signAiUpload);
  const read = useServerFn(signAiRead);
  const genSheet = useServerFn(generateRevisionSheet);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [meta, setMeta] = useState<ConvMeta | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [image, setImage] = useState<{ path: string; preview: string } | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setInitialLoad(true);
    setMessages([]);
    get({ data: { id: conversationId } })
      .then(async (res) => {
        const c = res.conversation as ConvMeta;
        setMeta(c);
        const msgs = (res.messages as Array<Omit<Msg, "signedImage" | "streaming">>).filter(
          (m) => m.role === "user" || m.role === "assistant",
        );
        const withUrls = await Promise.all(
          msgs.map(async (m) => {
            if (m.image_url) {
              try {
                const { signedUrl } = await read({ data: { path: m.image_url } });
                return { ...m, signedImage: signedUrl } as Msg;
              } catch {
                return m as Msg;
              }
            }
            return m as Msg;
          }),
        );
        setMessages(withUrls);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erreur"))
      .finally(() => {
        setInitialLoad(false);
        setTimeout(() => textRef.current?.focus(), 60);
      });
  }, [conversationId, get, read]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const onPickImage = useCallback(
    async (file: File | null) => {
      if (!file) return;
      if (file.size > 6 * 1024 * 1024) {
        toast.error("Image trop lourde (max 6 Mo)");
        return;
      }
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const { path, token } = await sign({ data: { ext } });
        const { error } = await supabase.storage
          .from("ai-uploads")
          .uploadToSignedUrl(path, token, file, { contentType: file.type });
        if (error) throw error;
        setImage({ path, preview: URL.createObjectURL(file) });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload échoué");
      }
    },
    [sign],
  );

  async function submit(opts?: {
    mode?: "chat" | "hint" | "harder";
    hintLevel?: number;
    overrideContent?: string;
  }) {
    const mode = opts?.mode ?? "chat";
    const content = opts?.overrideContent ?? input.trim();
    if (!content && !image) return;
    if (streaming) return;

    const sentImage = image;
    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: content || "(photo envoyée)",
      image_url: sentImage?.path ?? null,
      hint_level: null,
      signedImage: sentImage?.preview,
    };
    const asstId = `a-${Date.now()}`;
    const asstMsg: Msg = {
      id: asstId,
      role: "assistant",
      content: "",
      image_url: null,
      hint_level: opts?.hintLevel ?? null,
      streaming: true,
    };

    setMessages((p) => [...p, userMsg, asstMsg]);
    setInput("");
    setImage(null);
    setShowHints(false);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Session expirée");

      const res = await fetch(`/api/chat/${conversationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: userMsg.content,
          image_url: sentImage?.path,
          mode,
          hintLevel: opts?.hintLevel,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Erreur ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((p) =>
          p.map((m) => (m.id === asstId ? { ...m, content: acc } : m)),
        );
      }
      setMessages((p) =>
        p.map((m) => (m.id === asstId ? { ...m, streaming: false } : m)),
      );
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      if (!aborted) toast.error(e instanceof Error ? e.message : "Erreur IA");
      setMessages((p) =>
        p
          .map((m) =>
            m.id === asstId
              ? {
                  ...m,
                  streaming: false,
                  content: m.content || (aborted ? "_(interrompu)_" : "_(erreur)_"),
                }
              : m,
          )
          .filter((m) => !(m.id === asstId && !m.content)),
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
      setTimeout(() => textRef.current?.focus(), 50);
    }
  }

  function stopStream() {
    abortRef.current?.abort();
  }

  async function onGenSheet() {
    if (messages.length < 2) {
      toast.error("Discute au moins un peu avant de générer une fiche.");
      return;
    }
    toast.info("Génération de la fiche…");
    try {
      const { id } = await genSheet({ data: { conversationId } });
      toast.success("Fiche prête");
      window.location.href = `/ai/sheets/${id}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-xl">
        <div className="min-w-0">
          <div className="line-clamp-1 text-sm font-semibold">{meta?.title || "Conversation"}</div>
          <div className="text-[11px] text-muted-foreground">
            {meta?.subject ?? "Discussion libre"}
            {meta?.level ? ` · ${meta.level}` : ""}
            {meta?.chapter ? ` · ${meta.chapter}` : ""}
          </div>
        </div>
        <button
          onClick={onGenSheet}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:border-primary/50 hover:text-primary"
        >
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
            <div className="rounded-3xl border border-dashed border-border/60 bg-card/40 p-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
                💬
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Envoie ta première question — texte ou photo d'exercice.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}
        </div>
      </div>

      {showHints && (
        <div className="border-t border-border/60 bg-card/40 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Indice progressif :</span>
            {[
              { lvl: 1, label: "💡 Léger", txt: "Donne-moi un indice léger sans dévoiler la méthode." },
              { lvl: 2, label: "💡💡 Détaillé", txt: "Donne-moi un indice détaillé (méthode + formules) mais pas la réponse." },
              { lvl: 3, label: "💡💡💡 Solution", txt: "Donne-moi la solution complète étape par étape." },
            ].map((h) => (
              <button
                key={h.lvl}
                onClick={() => submit({ mode: "hint", hintLevel: h.lvl, overrideContent: h.txt })}
                className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/25"
              >
                {h.label}
              </button>
            ))}
            <button
              onClick={() => setShowHints(false)}
              className="ml-auto rounded p-1 text-muted-foreground hover:bg-secondary"
            >
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
        className="border-t border-border/60 bg-background/70 backdrop-blur-xl"
      >
        <div className="mx-auto max-w-3xl px-4 py-3">
          {image && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-2 py-1.5 text-xs">
              <img src={image.preview} alt="" className="h-9 w-9 rounded-lg object-cover" />
              <span>Photo prête à envoyer</span>
              <button
                type="button"
                onClick={() => setImage(null)}
                className="ml-1 rounded p-0.5 hover:bg-secondary"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-input/60 bg-card/70 p-2 shadow-[0_10px_40px_-20px_hsl(var(--primary)/0.35)] transition focus-within:border-primary/60">
            <label
              title="Envoyer une photo d'exercice"
              className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-primary"
            >
              <ImagePlus className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              onClick={() => setShowHints((s) => !s)}
              title="Demander un indice progressif"
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${
                showHints ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-primary"
              }`}
            >
              <Lightbulb className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                submit({
                  mode: "harder",
                  overrideContent: "Génère-moi un exercice similaire mais plus complexe.",
                })
              }
              title="Similaire mais + difficile"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-primary"
            >
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
              className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none"
            />
            {streaming ? (
              <button
                type="button"
                onClick={stopStream}
                title="Arrêter"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/90 text-destructive-foreground hover:bg-destructive"
              >
                <StopCircle className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && !image}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-1.5 px-1 text-[10px] text-muted-foreground/70">
            Entrée pour envoyer · Maj+Entrée pour retour à la ligne
          </div>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          {msg.signedImage && (
            <img
              src={msg.signedImage}
              alt="pièce jointe"
              className="mb-2 max-h-64 rounded-2xl object-contain ring-1 ring-border/60"
            />
          )}
          <div className="rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.5)]">
            {msg.content}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 text-primary ring-1 ring-primary/30">
        ✦
      </div>
      <div className="min-w-0 flex-1">
        {msg.hint_level && (
          <div className="mb-2 inline-block rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
            Indice niveau {msg.hint_level}
          </div>
        )}
        <div className="prose prose-sm prose-invert max-w-none text-foreground prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2 prose-pre:bg-card/60 prose-pre:border prose-pre:border-border/60">
          {msg.content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          ) : (
            <ShimmerLine />
          )}
          {msg.streaming && msg.content && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}

function ShimmerLine() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="inline-flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
      </span>
      Ostadi réfléchit…
    </div>
  );
}