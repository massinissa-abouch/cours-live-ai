import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Upload, Trash2, Loader2, PlayCircle, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addCourseVideo } from "@/lib/course.functions";

export const Route = createFileRoute("/_authenticated/teacher/courses/$courseId/chapters")({
  component: ChaptersPage,
});

type Video = { id: string; title: string; is_free_preview: boolean; video_url: string; order_index: number };

function ChaptersPage() {
  const { courseId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const addVid = useServerFn(addCourseVideo);

  const [courseTitle, setCourseTitle] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function reload() {
    const [{ data: c }, { data: v }] = await Promise.all([
      supabase.from("courses").select("title").eq("id", courseId).maybeSingle(),
      supabase.from("course_videos").select("id,title,is_free_preview,video_url,order_index").eq("course_id", courseId).order("order_index"),
    ]);
    setCourseTitle(c?.title ?? "");
    setVideos(v ?? []);
  }
  useEffect(() => { reload(); }, [courseId]);

  async function addChapter(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) { toast.error("Titre et vidéo obligatoires"); return; }
    setUploading(true);
    try {
      const path = `${user.id}/${courseId}/chapter-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("course-media").upload(path, file, { upsert: false });
      if (error) throw error;
      await addVid({ data: {
        courseId, title, videoPath: path, isFreePreview: isPreview, orderIndex: videos.length,
      }});
      toast.success("Chapitre ajouté ✓");
      setFile(null); setTitle(""); setIsPreview(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur upload");
    } finally {
      setUploading(false);
    }
  }

  async function removeChapter(id: string, path: string) {
    if (!confirm("Supprimer ce chapitre ?")) return;
    await supabase.from("course_videos").delete().eq("id", id);
    await supabase.storage.from("course-media").remove([path]);
    reload();
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
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Chapitres du cours</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{courseTitle}</h1>

        <form onSubmit={addChapter} className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du chapitre (ex : 1. Introduction)"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-background px-3 py-3 text-sm hover:bg-secondary/40">
            <Upload className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <div className="font-medium">{file?.name ?? "Choisir la vidéo du chapitre"}</div>
              <div className="text-xs text-muted-foreground">MP4 / WebM</div>
            </div>
            <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} />
            Chapitre gratuit (aperçu)
          </label>
          <button type="submit" disabled={uploading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Ajouter le chapitre
          </button>
        </form>

        <div className="mt-8 space-y-2">
          <div className="text-sm font-semibold">Chapitres publiés</div>
          {videos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun chapitre pour l'instant.</p>
          ) : videos.map((v, i) => (
            <div key={v.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-xs">{i + 1}</div>
              <div className="flex-1">
                <div className="text-sm font-medium">{v.title}</div>
                <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  {v.is_free_preview ? <><PlayCircle className="h-3 w-3 text-emerald-400" /> Preview gratuit</> : <><Lock className="h-3 w-3" /> Payant</>}
                </div>
              </div>
              <button onClick={() => removeChapter(v.id, v.video_url)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}