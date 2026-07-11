import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { streamText, type ModelMessage } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const BodySchema = z.object({
  content: z.string().min(1).max(8000),
  image_url: z.string().max(2000).optional(),
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
  const base = `Tu es Ostadi, tuteur IA bienveillant, patient et rigoureux pour les élèves algériens (BEM, BAC, université).

Style de conversation :
- Parle en français clair, chaleureux, comme un grand frère qui explique.
- Réponds de manière NATURELLE et conversationnelle, pas comme un manuel.
- Pose des questions de retour quand c'est utile pour vérifier la compréhension.
- Utilise Markdown : ### titres, listes, **gras**, > citations.
- Pour maths/physique/chimie : formules LaTeX en \\( ... \\) inline ou $$ ... $$ en bloc.
- Étape par étape, une idée à la fois. Encourage.

${subject ? `Matière : **${subject}**.` : ""}
${level ? `Niveau : **${level}**.` : ""}
${chapter ? `Chapitre : **${chapter}**.` : ""}

Contexte : programme scolaire algérien officiel (BEM, BAC scientifique/lettres/tech-math, licence).
Corrige avec bienveillance : explique OÙ et POURQUOI c'est faux, pas juste "faux".
Si l'élève envoie une photo d'exercice, lis attentivement l'énoncé et adapte tes explications.`;

  if (mode === "hint") {
    const t = hintLevel === 1
      ? "un indice LÉGER : juste une piste ou une question à se poser, aucune méthode."
      : hintLevel === 2
        ? "un indice DÉTAILLÉ : donne la méthode et les formules, MAIS PAS le résultat final."
        : "la SOLUTION COMPLÈTE, étape par étape, expliquée simplement.";
    return `${base}\n\n⚠️ MODE INDICE : Donne ${t}`;
  }
  if (mode === "harder") {
    return `${base}\n\n⚠️ MODE EXERCICE PLUS DIFFICILE : Génère un exercice SIMILAIRE au dernier envoyé mais NETTEMENT plus complexe (données changées, étape supplémentaire, cas particulier). Format :
### Énoncé
... (uniquement le nouvel énoncé, données nouvelles)
### Piste de départ
... (une phrase pour démarrer)`;
  }
  return base;
}

export const Route = createFileRoute("/api/chat/$conversationId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!auth) return new Response("Unauthorized", { status: 401 });

        const supabaseUrl = process.env.SUPABASE_URL;
        const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!supabaseUrl || !publishable || !lovableKey) {
          return new Response("Server misconfigured", { status: 500 });
        }

        const supabase = createClient<Database>(supabaseUrl, publishable, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${auth}` } },
        });
        const { data: userRes } = await supabase.auth.getUser(auth);
        const userId = userRes.user?.id;
        if (!userId) return new Response("Unauthorized", { status: 401 });

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const { data: conv } = await supabase
          .from("ai_conversations")
          .select("id,title,subject,level,chapter")
          .eq("id", params.conversationId)
          .eq("student_id", userId)
          .maybeSingle();
        if (!conv) return new Response("Not found", { status: 404 });

        const { data: history } = await supabase
          .from("ai_messages")
          .select("role,content,image_url")
          .eq("conversation_id", conv.id)
          .order("created_at");

        // Signed URL helper for images stored in ai-uploads
        const signImage = async (path: string): Promise<string | null> => {
          const { data: sig } = await supabase.storage
            .from("ai-uploads")
            .createSignedUrl(path, 3600);
          return sig?.signedUrl ?? null;
        };

        const messages: ModelMessage[] = [];
        for (const h of history ?? []) {
          if (h.role !== "user" && h.role !== "assistant") continue;
          if (h.role === "user" && h.image_url) {
            const url = await signImage(h.image_url);
            messages.push({
              role: "user",
              content: url
                ? [
                    { type: "text", text: h.content },
                    { type: "image", image: new URL(url) },
                  ]
                : h.content,
            });
          } else {
            messages.push({ role: h.role, content: h.content });
          }
        }

        // New user turn
        let newUrl: string | null = null;
        if (body.image_url) newUrl = await signImage(body.image_url);
        messages.push({
          role: "user",
          content: newUrl
            ? [
                { type: "text", text: body.content },
                { type: "image", image: new URL(newUrl) },
              ]
            : body.content,
        });

        // Persist user message immediately
        await supabase.from("ai_messages").insert({
          conversation_id: conv.id,
          role: "user",
          content: body.content,
          image_url: body.image_url ?? null,
        });

        const gateway = createLovableAiGatewayProvider(lovableKey);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: systemPrompt(conv.subject, conv.level, conv.chapter, body.mode, body.hintLevel),
          messages,
          onFinish: async ({ text }) => {
            await supabase.from("ai_messages").insert({
              conversation_id: conv.id,
              role: "assistant",
              content: text,
              hint_level: body.mode === "hint" ? (body.hintLevel ?? null) : null,
            });
            const wasFirst = !(history ?? []).length;
            if (wasFirst) {
              const title = body.content.slice(0, 60).replace(/\s+/g, " ").trim();
              await supabase
                .from("ai_conversations")
                .update({ title: title || "Nouvelle conversation" })
                .eq("id", conv.id);
            } else {
              await supabase
                .from("ai_conversations")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", conv.id);
            }
          },
        });

        return result.toTextStreamResponse();
      },
    },
  },
});