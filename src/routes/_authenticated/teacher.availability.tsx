import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2, Plus, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teacher/availability")({
  component: TeacherAvailability,
});

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

type Slot = { id: string; day_of_week: number; start_time: string; end_time: string };

function TeacherAvailability() {
  const { user } = Route.useRouteContext();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [day, setDay] = useState(1);
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("18:00");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function reload() {
    const { data } = await supabase
      .from("teacher_availability")
      .select("id, day_of_week, start_time, end_time")
      .eq("teacher_id", user.id)
      .order("day_of_week").order("start_time");
    setSlots(data ?? []);
    setLoading(false);
  }
  useEffect(() => { reload(); }, [user.id]);

  async function addSlot(e: React.FormEvent) {
    e.preventDefault();
    if (end <= start) { toast.error("L'heure de fin doit être après l'heure de début."); return; }
    setSaving(true);
    const { error } = await supabase.from("teacher_availability").insert({
      teacher_id: user.id, day_of_week: day, start_time: start, end_time: end, recurring: true,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Créneau ajouté");
    reload();
  }

  async function removeSlot(id: string) {
    const { error } = await supabase.from("teacher_availability").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSlots((s) => s.filter((x) => x.id !== id));
  }

  const grouped = DAYS.map((_, i) => slots.filter((s) => s.day_of_week === i));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link to="/teacher" className="flex items-center gap-2 text-sm hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Espace prof
          </Link>
          <span className="text-sm font-semibold">Mes créneaux</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/30">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Disponibilités hebdomadaires</h1>
            <p className="text-sm text-muted-foreground">Ajoute tes créneaux récurrents — les élèves les verront pour réserver.</p>
          </div>
        </div>

        <form onSubmit={addSlot} className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:grid-cols-[1fr_1fr_1fr_auto]">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Jour</label>
            <select value={day} onChange={(e) => setDay(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Début</label>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Fin</label>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={saving}
            className="mt-1 inline-flex items-center justify-center gap-2 self-end rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:mt-0">
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </form>

        <div className="mt-8 grid gap-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : slots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">Aucun créneau. Ajoute ton premier ci-dessus 👆</p>
            </div>
          ) : (
            grouped.map((daySlots, i) => daySlots.length > 0 && (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 text-sm font-semibold">{DAYS[i]}</div>
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((s) => (
                    <div key={s.id} className="group inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary">
                      {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                      <button onClick={() => removeSlot(s.id)}
                        className="rounded p-0.5 text-primary/70 hover:bg-primary/20 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}