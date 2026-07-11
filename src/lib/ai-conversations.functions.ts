import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ai_conversations")
      .select("id,title,subject,level,chapter,mode,updated_at")
      .eq("student_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: conv } = await context.supabase
      .from("ai_conversations")
      .select("id,title,subject,level,chapter,mode")
      .eq("id", data.id)
      .eq("student_id", context.userId)
      .maybeSingle();
    if (!conv) throw new Error("Conversation introuvable");
    const { data: msgs } = await context.supabase
      .from("ai_messages")
      .select("id,role,content,image_url,hint_level,created_at")
      .eq("conversation_id", data.id)
      .order("created_at");
    return { conversation: conv, messages: msgs ?? [] };
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      subject: z.string().max(80).optional(),
      level: z.string().max(40).optional(),
      chapter: z.string().max(120).optional(),
      title: z.string().max(120).optional(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ai_conversations")
      .insert({
        student_id: context.userId,
        title: data.title ?? "Nouvelle conversation",
        subject: data.subject ?? null,
        level: data.level ?? null,
        chapter: data.chapter ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("ai_conversations")
      .delete()
      .eq("id", data.id)
      .eq("student_id", context.userId);
    return { ok: true };
  });

const SendInput = z.object({
  conversationId: z.string().uuid(),
  userMessage: z.object({
    content: z.string().min(1).max(8000),
    image_url: z.string().max(2000).optional(),
  }),
  mode: z.enum(["chat", "hint", "harder"]).default("chat"),
  hintLevel: z.number().int().min(1).max(3).optional(),
});

function systemPrompt(
  subject: string | null,
  level: string | null,
  chapter: string | null,
  mode: "chat" | "hint" | "harder",
  hintLevel?: number,
) {
  const base = `Tu es Ostadi, tuteur IA bienveillant et rigoureux pour élèves algériens (BEM, BAC, université).
Réponds toujours en français clair. Structure avec Markdown (### titres, listes, gras).
Pour les maths/sciences : formules LaTeX \\( ... \\) inline ou $$ ... $$ en bloc.
${subject ? `Matière : ${subject}.` : ""}
${level ? `Niveau : ${level}.` : ""}
${chapter ? `Chapitre : ${chapter}.` : ""}
Programme algérien officiel. Explique étape par étape, corrige avec bienveillance.
Si l'élève envoie une photo d'exercice, comprends l'énoncé et adapte tes explications au sujet.`;

  if (mode === "hint") {
    const levelText =
      hintLevel === 1
        ? "un indice LÉGER : juste une piste, une question à se poser, sans donner la méthode."
        : hintLevel === 2
          ? "un indice DÉTAILLÉ : donne la méthode et les formules à utiliser, SANS le résultat final."
          : "la SOLUTION COMPLÈTE étape par étape.";
    return `${base}\n\nMODE INDICE : Ne donne PAS la réponse. Donne ${levelText}`;
  }
  if (mode === "harder") {
    return `${base}\n\nMODE : L'élève veut un exercice SIMILAIRE au dernier mais PLUS COMPLEXE (données différentes, une étape en plus). Fournis uniquement le nouvel énoncé (### Énoncé) puis ### Indice de départ.`;
  }
  return base;
}

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SendInput.parse(i))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");

    const { data: conv } = await context.supabase
      .from("ai_conversations")
      .select("id,title,subject,level,chapter")
      .eq("id", data.conversationId)
      .eq("student_id", context.userId)
      .maybeSingle();
    if (!conv) throw new Error("Conversation introuvable");

    const { data: history } = await context.supabase
      .from("ai_messages")
      .select("role,content,image_url")
      .eq("conversation_id", conv.id)
      .order("created_at");

    await context.supabase.from("ai_messages").insert({
      conversation_id: conv.id,
      role: "user",
      content: data.userMessage.content,
      image_url: data.userMessage.image_url ?? null,
    });

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    type Part = { type: "text"; text: string } | { type: "image"; image: string };
    const modelMessages: Array<{ role: "user" | "assistant"; content: string | Part[] }> = [];
    for (const h of history ?? []) {
      if (h.role === "user" && h.image_url) {
        modelMessages.push({
          role: "user",
          content: [
            { type: "text", text: h.content },
            { type: "image", image: h.image_url },
          ],
        });
      } else if (h.role === "user" || h.role === "assistant") {
        modelMessages.push({ role: h.role, content: h.content });
      }
    }
    const parts: Part[] = [{ type: "text", text: data.userMessage.content }];
    if (data.userMessage.image_url) parts.push({ type: "image", image: data.userMessage.image_url });
    modelMessages.push({ role: "user", content: parts });

    const { text } = await generateText({
      model,
      system: systemPrompt(conv.subject, conv.level, conv.chapter, data.mode, data.hintLevel),
      messages: modelMessages,
    });

    await context.supabase.from("ai_messages").insert({
      conversation_id: conv.id,
      role: "assistant",
      content: text,
      hint_level: data.mode === "hint" ? (data.hintLevel ?? null) : null,
    });

    if ((history ?? []).length === 0) {
      const shortTitle = data.userMessage.content.slice(0, 60).replace(/\n/g, " ");
      await context.supabase
        .from("ai_conversations")
        .update({ title: shortTitle })
        .eq("id", conv.id);
    } else {
      await context.supabase
        .from("ai_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conv.id);
    }

    return { reply: text };
  });

export const signAiUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ ext: z.string().max(8) }).parse(i))
  .handler(async ({ data, context }) => {
    const clean = data.ext.replace(/[^a-z0-9]/gi, "");
    const path = `${context.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${clean}`;
    const { data: sig, error } = await context.supabase.storage
      .from("ai-uploads")
      .createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: sig.token, signedUrl: sig.signedUrl };
  });

export const signAiRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ path: z.string().max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: sig, error } = await context.supabase.storage
      .from("ai-uploads")
      .createSignedUrl(data.path, 3600);
    if (error) throw error;
    return { signedUrl: sig.signedUrl };
  });
