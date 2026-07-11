import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher/courses/new")({
  component: NewCourse,
});

type Level = "primaire" | "cem_1" | "cem_2" | "cem_3" | "cem_4"
  | "lycee_1_tc" | "lycee_2_sciences" | "lycee_2_lettres" | "lycee_2_maths"
  | "lycee_2_gestion" | "lycee_2_langues" | "lycee_2_techmath"
  | "lycee_3_sciences" | "lycee_3_lettres" | "lycee_3_maths"
  | "lycee_3_gestion" | "lycee_3_langues" | "lycee_3_techmath"
  | "univ_1" | "univ_2" | "univ_3" | "autre";

const LEVEL_OPTIONS: { v: Level; l: string }[] = [
  { v: "cem_4", l: "4AM (BEM)" },
  { v: "lycee_1_tc", l: "1AS Tronc commun" },
  { v: "lycee_2_sciences", l: "2AS Sciences" },
  { v: "lycee_2_maths", l: "2AS Maths" },
  { v: "lycee_2_techmath", l: "2AS Technique-Math" },
  { v: "lycee_2_lettres", l: "2AS Lettres" },
  { v: "lycee_3_sciences", l: "3AS Sciences (BAC)" },
  { v: "lycee_3_maths", l: "3AS Maths (BAC)" },
  { v: "lycee_3_techmath", l: "3AS Technique-Math (BAC)" },
  { v: "lycee_3_lettres", l: "3AS Lettres (BAC)" },
  { v: "univ_1", l: "Université L1" },
  { v: "univ_2", l: "Université L2" },
  { v: "univ_3", l: "Université L3" },
  { v: "autre", l: "Autre" },
];

function NewCourse() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState<Level>("lycee_3_sciences");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(1500);
  const [trailer, setTrailer] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function uploadTo(bucket: string, file: File, prefix: string) {
    const path = `${user.id}/${prefix}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trailer) {
      toast.error("La vidéo trailer est obligatoire");
      return;
    }
    setSaving(true);
    try {
      const trailerPath = await uploadTo("course-media", trailer, "trailer");
      let thumbPath: string | null = null;
      if (thumbnail) thumbPath = await uploadTo("course-media", thumbnail, "thumb");

      const { data, error } = await supabase.from("courses").insert({
        teacher_id: user.id,
        title,
        subject,
        level,
        description,
        price,
        trailer_video_url: trailerPath,
        thumbnail_url: thumbPath,
        status: "published",
      }).select("id").single();
      if (error) throw error;

      toast.success("Cours publié !");
      navigate({ to: "/courses/$courseId", params: { courseId: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur upload");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Link to="/teacher" className="flex items-center gap-2 text-sm hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Espace prof
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Nouveau cours</h1>
        <p className="mt-1 text-sm text-muted-foreground">Un cours = une série vidéo autour d'un chapitre ou d'une matière.</p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <Field label="Titre">
            <input required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Fonctions du second degré — 3AS"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Matière">
              <input required value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="Mathématiques, Physique…"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm" />
            </Field>
            <Field label="Niveau">
              <select value={level} onChange={(e) => setLevel(e.target.value as Level)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm">
                {LEVEL_OPTIONS.map((o) => (<option key={o.v} value={o.v}>{o.l}</option>))}
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Ce que l'élève va apprendre, les prérequis, la durée…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm" />
          </Field>
          <Field label="Prix (DZD)">
            <input required type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm" />
          </Field>

          <Field label="Vidéo trailer (gratuite, obligatoire)">
            <FileInput file={trailer} onChange={setTrailer} accept="video/*" hint="MP4 / WebM — jusqu'à 500 MB" />
          </Field>
          <Field label="Miniature (optionnel)">
            <FileInput file={thumbnail} onChange={setThumbnail} accept="image/*" hint="JPG / PNG — 16:9 conseillé" />
          </Field>

          <div className="rounded-xl bg-secondary/50 p-4 text-xs text-muted-foreground">
            Astuce : tu pourras ajouter les vidéos payantes du cours après la création.
          </div>

          <button type="submit" disabled={saving}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-90 disabled:opacity-60">
            {saving ? "Envoi en cours…" : "Publier le cours"}
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">{label}</label>
      {children}
    </div>
  );
}

function FileInput({ file, onChange, accept, hint }: { file: File | null; onChange: (f: File | null) => void; accept: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-background px-3 py-3 text-sm hover:bg-secondary/40">
      <Upload className="h-4 w-4 text-primary" />
      <div className="flex-1">
        <div className="font-medium">{file ? file.name : "Choisir un fichier"}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <input type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] ?? null)} className="hidden" />
    </label>
  );
}