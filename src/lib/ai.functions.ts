import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GenerateInput = z.object({
  subject: z.string().min(1).max(80),
  level: z.string().min(1).max(40),
  chapter: z.string().max(120).optional(),
  difficulty: z.number().min(1).max(5).default(3),
  sourceText: z.string().max(4000).optional(),
  imageDataUrl: z.string().optional(),
});

export const generateAiExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `Tu es un tuteur pour le programme scolaire algérien (BEM, BAC, université).
Génère UN exercice original, aligné sur la matière et le niveau donnés, légèrement plus corsé que la source si elle est fournie.
Réponds en français.
Format Markdown STRICT :
### Énoncé
<énoncé clair et complet>
### Indice
<un indice, une piste>
### Correction détaillée
<résolution étape par étape>
### Réponse finale
<résultat encadré>`;

    const userText = [
      `Matière : ${data.subject}`,
      `Niveau : ${data.level}`,
      data.chapter ? `Chapitre : ${data.chapter}` : null,
      `Difficulté (1-5) : ${data.difficulty}`,
      data.sourceText ? `Sujet source :\n${data.sourceText}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const content: Array<{ type: "text"; text: string } | { type: "image"; image: string }> = [
      { type: "text", text: userText },
    ];
    if (data.imageDataUrl) {
      content.push({ type: "image", image: data.imageDataUrl });
    }

    const { text } = await generateText({
      model,
      system,
      messages: [{ role: "user", content }],
    });

    // Persist
    const levelEnum = data.level as
      | "primaire" | "cem_1" | "cem_2" | "cem_3" | "cem_4"
      | "lycee_1_tc" | "lycee_2_sciences" | "lycee_2_lettres" | "lycee_2_maths"
      | "lycee_2_gestion" | "lycee_2_langues" | "lycee_2_techmath"
      | "lycee_3_sciences" | "lycee_3_lettres" | "lycee_3_maths"
      | "lycee_3_gestion" | "lycee_3_langues" | "lycee_3_techmath"
      | "univ_1" | "univ_2" | "univ_3" | "autre";

    await context.supabase.from("ai_exercises").insert({
      student_id: context.userId,
      subject: data.subject,
      level: levelEnum,
      difficulty: data.difficulty,
      source_type: data.imageDataUrl ? "from_photo" : data.sourceText ? "from_text" : "generated",
      source_content: data.sourceText ?? null,
      generated_exercise: { markdown: text, chapter: data.chapter ?? null },
    });

    return { exercise: text };
  });

const GradeInput = z.object({
  exerciseMarkdown: z.string().min(1).max(8000),
  studentAnswer: z.string().min(1).max(4000),
});

export const gradeAiAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GradeInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const { text } = await generateText({
      model,
      system: `Tu es un correcteur bienveillant pour élèves algériens. Corrige la réponse de l'élève en français.
Format Markdown :
### Note (sur 20)
<note>
### Ce qui est bon
### À améliorer
### Correction proposée`,
      messages: [
        {
          role: "user",
          content: `Exercice :\n${data.exerciseMarkdown}\n\nRéponse de l'élève :\n${data.studentAnswer}`,
        },
      ],
    });
    return { feedback: text };
  });