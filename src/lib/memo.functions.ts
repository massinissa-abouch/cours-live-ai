import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Types ----------
export type MemoBlock = { title: string; key_points: string[] };
export type MemoFormats = {
  summary_bullets: string[];
  mnemonics: Array<{ label: string; trick: string }>;
  timeline: Array<{ date: string; event: string }>;
  mindmap: { center: string; branches: Array<{ label: string; children: string[] }> };
  flashquiz: Array<
    | { kind: "truefalse"; question: string; answer: boolean; explanation?: string }
    | { kind: "cloze"; question: string; answer: string; explanation?: string }
  >;
};

// ---------- Helpers ----------
function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json\s*|```/g, "").trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  try { return JSON.parse(m ? m[0] : cleaned); } catch { return {}; }
}

// ---------- Generate a full memo sheet from long content ----------
const GenerateInput = z.object({
  sourceText: z.string().max(60_000).optional(),
  imageDataUrl: z.string().max(6_000_000).optional(),
  level: z.string().max(40).optional(),
  hintSubject: z.string().max(60).optional(),
});

export const generateMemoSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => GenerateInput.parse(i))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");
    if (!data.sourceText && !data.imageDataUrl) throw new Error("Fournis du texte ou une photo");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `Tu es un pédagogue expert du programme scolaire algérien (histoire, géographie, sciences, langues).
On te donne un cours LONG et dense. Ta mission : le transformer en une fiche mémo courte, ultra facile à retenir pour un élève.

Réponds STRICTEMENT en JSON valide (pas de texte autour, pas de markdown) avec CE schéma exact :
{
  "title": string,                         // titre court du chapitre (<= 80 car.)
  "subject": string,                       // matière (ex: "Histoire", "Géographie", "SVT"...)
  "level": string,                         // niveau détecté ("BEM", "1AS", "2AS", "3AS BAC"...)
  "chapter": string,                       // chapitre / leçon
  "blocks": [                              // 3 à 8 blocs pédagogiques progressifs
    { "title": string, "key_points": [string, ...] }   // 2 à 5 points par bloc, phrases courtes
  ],
  "formats": {
    "summary_bullets": [string, ...],      // 5 à 10 idées essentielles, 1 phrase courte chacune
    "mnemonics": [ { "label": string, "trick": string }, ... ],  // 2 à 5 moyens mnémotechniques (acronymes, phrases, associations)
    "timeline": [ { "date": string, "event": string }, ... ],    // pertinent pour l'histoire ; sinon []
    "mindmap": {                            // pertinent pour géo/notions ; sinon center vide + branches []
      "center": string,
      "branches": [ { "label": string, "children": [string, ...] } ]
    },
    "flashquiz": [                          // 6 à 10 questions courtes
      { "kind": "truefalse", "question": string, "answer": boolean, "explanation": string }
      // ou { "kind":"cloze", "question": "Napoléon est né en ___", "answer": "1769", "explanation": "..." }
    ]
  }
}

Règles :
- Écris tout en FRANÇAIS clair et simple.
- Phrases COURTES, pas de blabla. Priorité aux dates, noms, chiffres, lieux clés.
- Découpe les blocs pour révision espacée (le bloc 1 = les bases, dernier bloc = détails avancés).
- N'invente pas de faits qui ne sont pas dans le cours fourni.`;

    const userText = [
      data.level ? `Niveau élève : ${data.level}` : null,
      data.hintSubject ? `Indice matière : ${data.hintSubject}` : null,
      data.sourceText ? `COURS À TRANSFORMER :\n${data.sourceText}` : null,
      data.imageDataUrl ? "Une photo du cours est fournie. Lis-la attentivement (OCR) puis produis la fiche." : null,
    ].filter(Boolean).join("\n\n");

    const content: Array<{ type: "text"; text: string } | { type: "image"; image: string }> = [
      { type: "text", text: userText },
    ];
    if (data.imageDataUrl) content.push({ type: "image", image: data.imageDataUrl });

    const { text } = await generateText({
      model,
      system,
      messages: [{ role: "user", content }],
    });

    const raw = extractJson(text) as Record<string, unknown>;
    const asStr = (v: unknown, fb = "") => typeof v === "string" ? v : fb;
    const asArr = <T>(v: unknown): T[] => Array.isArray(v) ? (v as T[]) : [];

    const title = asStr(raw.title, "Fiche mémo").slice(0, 100);
    const subject = asStr(raw.subject, data.hintSubject ?? "Autre").slice(0, 60);
    const level = asStr(raw.level, data.level ?? "").slice(0, 40);
    const chapter = asStr(raw.chapter, "").slice(0, 120);

    const blocks: MemoBlock[] = asArr<Record<string, unknown>>(raw.blocks)
      .slice(0, 8)
      .map((b) => ({
        title: asStr(b.title, "Bloc").slice(0, 100),
        key_points: asArr<string>(b.key_points).filter((s) => typeof s === "string").slice(0, 6),
      }))
      .filter((b) => b.key_points.length > 0);

    if (!blocks.length) throw new Error("La génération n'a produit aucun bloc. Réessaie avec un extrait plus court.");

    const rawFormats = (raw.formats ?? {}) as Record<string, unknown>;
    const formats: MemoFormats = {
      summary_bullets: asArr<string>(rawFormats.summary_bullets).filter((s) => typeof s === "string").slice(0, 12),
      mnemonics: asArr<Record<string, unknown>>(rawFormats.mnemonics).map((m) => ({
        label: asStr(m.label, ""),
        trick: asStr(m.trick, ""),
      })).filter((m) => m.trick).slice(0, 6),
      timeline: asArr<Record<string, unknown>>(rawFormats.timeline).map((e) => ({
        date: asStr(e.date, ""),
        event: asStr(e.event, ""),
      })).filter((e) => e.date && e.event).slice(0, 20),
      mindmap: (() => {
        const mm = (rawFormats.mindmap ?? {}) as Record<string, unknown>;
        return {
          center: asStr(mm.center, chapter),
          branches: asArr<Record<string, unknown>>(mm.branches).map((br) => ({
            label: asStr(br.label, ""),
            children: asArr<string>(br.children).filter((s) => typeof s === "string").slice(0, 6),
          })).filter((br) => br.label).slice(0, 8),
        };
      })(),
      flashquiz: asArr<Record<string, unknown>>(rawFormats.flashquiz).map((q) => {
        const kind = q.kind === "cloze" ? "cloze" : "truefalse";
        if (kind === "truefalse") {
          return { kind: "truefalse", question: asStr(q.question, ""), answer: q.answer === true, explanation: asStr(q.explanation, "") } as const;
        }
        return { kind: "cloze", question: asStr(q.question, ""), answer: asStr(q.answer, ""), explanation: asStr(q.explanation, "") } as const;
      }).filter((q) => q.question).slice(0, 12),
    };

    // Persist
    const { data: row, error } = await context.supabase
      .from("memo_sheets")
      .insert({
        student_id: context.userId,
        title,
        subject,
        level: level || null,
        chapter: chapter || null,
        source_text: data.sourceText ?? null,
        source_kind: data.imageDataUrl ? "photo" : "text",
        blocks: blocks as never,
        formats: formats as never,
      })
      .select("id")
      .single();
    if (error) throw error;

    return { id: row.id, title, subject, level, chapter, blocks, formats };
  });

// ---------- List ----------
export const listMemoSheets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("memo_sheets")
      .select("id,title,subject,level,chapter,created_at")
      .eq("student_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

// ---------- Get single sheet with progress ----------
export const getMemoSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: sheet } = await context.supabase
      .from("memo_sheets")
      .select("*")
      .eq("id", data.id)
      .eq("student_id", context.userId)
      .maybeSingle();
    if (!sheet) throw new Error("Fiche introuvable");
    const { data: prog } = await context.supabase
      .from("memo_progress")
      .select("block_index,mastered_at,quiz_score,attempts,next_review_at")
      .eq("sheet_id", data.id)
      .eq("student_id", context.userId);
    return {
      ...sheet,
      blocks: (sheet.blocks as unknown as MemoBlock[]) ?? [],
      formats: (sheet.formats as unknown as MemoFormats) ?? { summary_bullets: [], mnemonics: [], timeline: [], mindmap: { center: "", branches: [] }, flashquiz: [] },
      progress: prog ?? [],
    };
  });

// ---------- Delete ----------
export const deleteMemoSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("memo_sheets")
      .delete()
      .eq("id", data.id)
      .eq("student_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Simplify one block further ----------
export const simplifyBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), blockIndex: z.number().int().min(0).max(20) }).parse(i))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY manquant");

    const { data: sheet } = await context.supabase
      .from("memo_sheets")
      .select("blocks,subject,chapter")
      .eq("id", data.id)
      .eq("student_id", context.userId)
      .maybeSingle();
    if (!sheet) throw new Error("Fiche introuvable");

    const blocks = (sheet.blocks as unknown as MemoBlock[]) ?? [];
    const block = blocks[data.blockIndex];
    if (!block) throw new Error("Bloc introuvable");

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: `Tu simplifies encore plus un bloc de révision pour un élève algérien qui trouve la version actuelle trop dense.
Réponds STRICTEMENT en JSON : {"title": string, "key_points": [string,...]}.
Règles : 2 à 4 points, phrases très courtes (max 10 mots), langage simple, garder l'essentiel.`,
      prompt: `Matière : ${sheet.subject ?? "?"} — Chapitre : ${sheet.chapter ?? "?"}\n\nBloc actuel :\nTitre : ${block.title}\nPoints :\n- ${block.key_points.join("\n- ")}`,
    });
    const parsed = extractJson(text) as { title?: string; key_points?: string[] };
    const simpler: MemoBlock = {
      title: typeof parsed.title === "string" ? parsed.title : block.title,
      key_points: Array.isArray(parsed.key_points) ? parsed.key_points.filter((s) => typeof s === "string").slice(0, 4) : block.key_points,
    };

    const updated = [...blocks];
    updated[data.blockIndex] = simpler;
    const { error } = await context.supabase
      .from("memo_sheets")
      .update({ blocks: updated as never })
      .eq("id", data.id)
      .eq("student_id", context.userId);
    if (error) throw error;
    return simpler;
  });

// ---------- Mark block mastered (spaced repetition light) ----------
export const markBlockProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    sheetId: z.string().uuid(),
    blockIndex: z.number().int().min(0).max(20),
    quizScore: z.number().min(0).max(1).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const mastered = (data.quizScore ?? 1) >= 0.7;
    // Espacement : J+1 si score < 0.7 sinon J+3 (puis re-vu à J+7 après 2 réussites)
    const { data: existing } = await context.supabase
      .from("memo_progress")
      .select("attempts")
      .eq("sheet_id", data.sheetId)
      .eq("block_index", data.blockIndex)
      .eq("student_id", context.userId)
      .maybeSingle();
    const attempts = (existing?.attempts ?? 0) + 1;
    const gapDays = !mastered ? 1 : attempts >= 2 ? 7 : 3;
    const next = new Date(Date.now() + gapDays * 86_400_000).toISOString();

    const { error } = await context.supabase
      .from("memo_progress")
      .upsert({
        sheet_id: data.sheetId,
        student_id: context.userId,
        block_index: data.blockIndex,
        mastered_at: mastered ? new Date().toISOString() : null,
        quiz_score: data.quizScore ?? null,
        attempts,
        next_review_at: next,
      }, { onConflict: "sheet_id,block_index" });
    if (error) throw error;
    return { mastered, nextReviewAt: next, attempts };
  });
