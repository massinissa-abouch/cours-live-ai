import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Msg = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const ChatInput = z.object({
  messages: z.array(Msg).min(1).max(40),
  subject: z.string().max(80).optional(),
  level: z.string().max(40).optional(),
});

export const chatWithTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `Tu es Ostadi, un tuteur IA bienveillant et rigoureux pour les élèves et étudiants algériens (programme BEM, BAC, université).
Réponds toujours en français clair, avec des explications étape par étape et des exemples concrets liés au programme algérien quand c'est pertinent.
Utilise le Markdown (titres ###, listes, gras) pour structurer. Pour les maths et sciences, écris les formules en LaTeX inline avec \\( ... \\) ou en bloc avec $$ ... $$.
${data.subject ? `Matière du contexte : ${data.subject}.` : ""}
${data.level ? `Niveau : ${data.level}.` : ""}
Si l'élève se trompe, corrige gentiment et propose un exercice de renforcement.`;

    const { text } = await generateText({
      model,
      system,
      messages: data.messages,
    });

    return { reply: text };
  });