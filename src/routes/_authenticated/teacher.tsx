import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher")({
  component: TeacherLayout,
});

type Course = {
  id: string;
  title: string;
  subject: string;
  status: string;
  price: number;
  enrolled_count: number;
};

function TeacherLayout() {
  const { user } = Route.useRouteContext();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("courses")
        .select("id,title,subject,status,price,enrolled_count")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });
      setCourses(data ?? []);
      setLoading(false);
    })();
  }, [user.id]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <span className="text-sm font-semibold">Espace prof</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mes cours</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Publie tes séries vidéo. Chaque cours doit avoir un trailer gratuit.
            </p>
          </div>
          <Link to="/teacher/courses/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-90">
            <Plus className="h-4 w-4" /> Nouveau cours
          </Link>
        </div>

        <div className="mt-8">
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">Aucun cours pour l'instant.</p>
              <Link to="/teacher/courses/new"
                className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Créer mon premier cours
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {courses.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div>
                    <div className="font-semibold">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{c.subject} · {c.enrolled_count} inscrits</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">{c.price} DZD</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${c.status === "published" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Outlet />
      </main>
    </div>
  );
}