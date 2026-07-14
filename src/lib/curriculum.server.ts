// Server-side helpers to fetch the official Algerian curriculum chapters
// and format them for AI system prompts.
// Used from server functions and server routes only.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Lang } from "@/lib/i18n/translations";

type Client = SupabaseClient<Database>;

export type CurriculumChapter = {
  order: number;
  title_fr: string;
  title_ar: string | null;
};

// Normalize a free-form subject label to the DB key we use in `curriculum.subject`.
const SUBJECT_ALIASES: Record<string, string> = {
  "math": "mathematiques",
  "maths": "mathematiques",
  "mathematique": "mathematiques",
  "mathematiques": "mathematiques",
  "mathématiques": "mathematiques",
  "physique": "physique",
  "physique-chimie": "physique",
  "chimie": "physique",
  "svt": "svt",
  "sciences": "svt",
  "biologie": "svt",
  "histoire": "histoire_geo",
  "geographie": "histoire_geo",
  "géographie": "histoire_geo",
  "histoire-geo": "histoire_geo",
  "histoire_geo": "histoire_geo",
  "français": "francais",
  "francais": "francais",
  "arabe": "arabe",
  "anglais": "anglais",
  "english": "anglais",
  "philosophie": "philosophie",
  "philo": "philosophie",
  "economie": "economie",
  "économie": "economie",
  "droit": "droit",
};

// Normalize a free-form level label to the DB key we use in `curriculum.level`.
const LEVEL_ALIASES: Record<string, string> = {
  "primaire": "primaire",
  "1am": "cem_1",
  "2am": "cem_2",
  "3am": "cem_3",
  "4am": "cem_4",
  "bem": "cem_4",
  "cem": "cem_4",
  "cem_4": "cem_4",
  "1as": "1as",
  "2as": "2as",
  "3as": "3as",
  "bac": "3as",
  "terminale": "3as",
};

const FILIERE_ALIASES: Record<string, string> = {
  "sciences": "sciences_exp",
  "sciences_experimentales": "sciences_exp",
  "sciences expérimentales": "sciences_exp",
  "sciences exp": "sciences_exp",
  "sciences_exp": "sciences_exp",
  "maths": "maths",
  "mathematiques": "maths",
  "mathématiques": "maths",
  "tech maths": "tech_maths",
  "techniques mathematiques": "tech_maths",
  "techniques mathématiques": "tech_maths",
  "tech_maths": "tech_maths",
  "lettres": "lettres_philo",
  "lettres philo": "lettres_philo",
  "lettres et philosophie": "lettres_philo",
  "lettres_philo": "lettres_philo",
  "lettres langues": "lettres_langues",
  "lettres et langues": "lettres_langues",
  "lettres_langues": "lettres_langues",
  "gestion": "gestion_economie",
  "gestion economie": "gestion_economie",
  "gestion-economie": "gestion_economie",
  "gestion_economie": "gestion_economie",
  "commun": "commun",
};

function normalize(v: string | null | undefined, map: Record<string, string>): string | null {
  if (!v) return null;
  const k = v.trim().toLowerCase();
  return map[k] ?? null;
}

export function normalizeSubject(v: string | null | undefined) { return normalize(v, SUBJECT_ALIASES); }
export function normalizeLevel(v: string | null | undefined) { return normalize(v, LEVEL_ALIASES); }
export function normalizeFiliere(v: string | null | undefined) { return normalize(v, FILIERE_ALIASES); }

export async function fetchChapters(
  client: Client,
  opts: { level?: string | null; subject?: string | null; filiere?: string | null },
): Promise<CurriculumChapter[]> {
  const level = normalizeLevel(opts.level);
  const subject = normalizeSubject(opts.subject);
  if (!level || !subject) return [];
  const filiere = normalizeFiliere(opts.filiere);

  // Try exact filière match first, then fall back to "commun", then null (CEM).
  const attempts: Array<string | null> = [];
  if (filiere) attempts.push(filiere);
  attempts.push("commun");
  attempts.push(null);

  for (const f of attempts) {
    let q = client
      .from("curriculum")
      .select("chapter_order,chapter_title_fr,chapter_title_ar")
      .eq("level", level)
      .eq("subject", subject)
      .order("chapter_order");
    q = f === null ? q.is("filiere", null) : q.eq("filiere", f);
    const { data } = await q;
    if (data && data.length > 0) {
      return data.map((r) => ({
        order: r.chapter_order,
        title_fr: r.chapter_title_fr,
        title_ar: r.chapter_title_ar,
      }));
    }
  }
  return [];
}

// Format a curriculum block for injection into an AI system prompt.
export function curriculumPromptBlock(
  chapters: CurriculumChapter[],
  lang: Lang,
  ctx: { level?: string | null; subject?: string | null; filiere?: string | null },
): string {
  if (chapters.length === 0) return "";
  const isAr = lang === "ar";
  const header = isAr
    ? `📚 البرنامج الرسمي الجزائري — المستوى: ${ctx.level ?? "?"}${ctx.filiere ? ` · الشعبة: ${ctx.filiere}` : ""} · المادة: ${ctx.subject ?? "?"}`
    : `📚 Programme officiel algérien — Niveau : ${ctx.level ?? "?"}${ctx.filiere ? ` · Filière : ${ctx.filiere}` : ""} · Matière : ${ctx.subject ?? "?"}`;
  const list = chapters.map((c) => {
    const title = isAr && c.title_ar ? c.title_ar : c.title_fr;
    return `  ${c.order}. ${title}`;
  }).join("\n");
  const guidance = isAr
    ? `\n\nقواعد إلزامية :\n- حدّد أولاً الفصل الرسمي الذي يتعلق به سؤال التلميذ.\n- استعمل المصطلحات والرموز الرسمية المستعملة في الكتب المدرسية الجزائرية.\n- طبّق طريقة الحل المطلوبة في امتحان ${ctx.level === "cem_4" ? "شهادة التعليم المتوسط BEM" : "شهادة البكالوريا"} الجزائري، لا طرقاً بديلة قد تُربك التلميذ.\n- إن كان السؤال خارج البرنامج الرسمي لهذا المستوى، نبّه التلميذ بلطف قبل الإجابة.`
    : `\n\nRègles impératives :\n- Identifie d'abord à quel chapitre officiel ci-dessus correspond la question de l'élève.\n- Utilise la terminologie et les notations officielles des manuels algériens.\n- Applique la méthode de résolution attendue à l'examen ${ctx.level === "cem_4" ? "BEM" : "BAC"} algérien, pas une méthode alternative qui pourrait dérouter l'élève.\n- Si la question sort du programme officiel de ce niveau, signale-le poliment avant de répondre.`;
  return `${header}\nChapitres officiels :\n${list}${guidance}`;
}

// Language directive to append to every AI system prompt.
export function languageDirective(lang: Lang): string {
  if (lang === "ar") {
    return `🗣️ اللغة : أجب دائماً باللغة العربية الفصحى الحديثة، بأسلوب مدرسي واضح.
- إذا كتب التلميذ بالدارجة أو خلط بين العربية والفرنسية، افهم مقصده وأجب دائماً بالفصحى.
- استعمل ترميز LaTeX للرياضيات والفيزياء : \\( ... \\) داخل السطر أو $$ ... $$ في سطر مستقل.
- المفردات الرياضية الرسمية الجزائرية : "الاشتقاق"، "النهاية"، "المتتالية"، "الجذر التربيعي"، إلخ.`;
  }
  return `🗣️ Langue : réponds toujours en français clair et scolaire.
- Si l'élève écrit en darija, en arabe ou mélange les deux, comprends le sens et réponds en français.
- Utilise LaTeX pour les maths/physique : \\( ... \\) en inline ou $$ ... $$ en bloc.
- Emploie la terminologie officielle des manuels algériens (ex: "dérivée", "primitive", "théorème de Thalès").`;
}