import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchChapters, curriculumPromptBlock, languageDirective } from "./curriculum.server";

const Msg = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const ChatInput = z.object({
  messages: z.array(Msg).min(1).max(40),
  subject: z.string().max(80).optional(),
  level: z.string().max(40).optional(),
  filiere: z.string().max(60).optional(),
  language: z.enum(["fr", "ar"]).optional(),
});

export const chatWithTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");

    // Resolve language: explicit input > user profile > fr
    let lang: "fr" | "ar" = data.language ?? "fr";
    if (!data.language) {
      const { data: prof } = await context.supabase
        .from("student_profiles")
        .select("preferred_language,school_level")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (prof?.preferred_language === "ar") lang = "ar";
    }

    const chapters = await fetchChapters(context.supabase, {
      level: data.level,
      subject: data.subject,
      filiere: data.filiere,
    });
    const curriculumBlock = curriculumPromptBlock(chapters, lang, {
      level: data.level,
      subject: data.subject,
      filiere: data.filiere,
    });

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `Tu es Ostadi, un tuteur IA bienveillant et rigoureux pour les élèves algériens (programme officiel BEM, BAC, université).
Explique étape par étape, utilise Markdown (### titres, listes, **gras**) et corrige les erreurs avec douceur en proposant un exercice de renforcement.

${languageDirective(lang)}

${curriculumBlock}`;

    const { text } = await generateText({
      model,
      system,
      messages: data.messages,
    });

    return { reply: text };
  });