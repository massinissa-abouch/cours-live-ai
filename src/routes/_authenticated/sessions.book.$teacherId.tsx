import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Users, User, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listTeacherSessions, bookSession } from "@/lib/live-session.functions";

export const Route = createFileRoute("/_authenticated/sessions/book/$teacherId")({
  component: BookTeacher,
});

type Row = Awaited<ReturnType<typeof listTeacherSessions>>[number];

function BookTeacher() {
  const { teacherId } = Route.useParams();
  const load = useServerFn(listTeacherSessions);
  const book = useServerFn(bookSession);
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const [{ data: prof }, list, { data: user }] = await Promise.all([
        supabase.from("profiles").select("full_name,avatar_url").eq("id", teacherId).maybeSingle(),
        load({ data: { teacherId } }),
        supabase.auth.getUser(),
      ]);
      setTeacher(prof ?? null);
      setRows(list);
      if (user.user) {
        const { data: mine } = await supabase
          .from("session_bookings")
          .select("session_id,status")
          .eq("student_id", user.user.id)
          .in("status", ["booked", "attended"]);
        setBookedIds(new Set((mine ?? []).map((b) => b.session_id)));
      }
      setLoading(false);
    })();
  }, [teacherId, load]);

  async function handleBook(row: Row) {
    setBusyId(row.id);
    try {
      const res = await book({ data: { sessionId: row.id, mode: row.session_type as "solo" | "group" } });
      toast.success("Réservation confirmée ✓");
      setBookedIds((s) => new Set([...s, row.id]));
      if (res.sessionId) navigate({ to: "/live/$sessionId", params: { sessionId: res.sessionId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-4">
          <Link to="/teachers" className="flex items-center gap-2 text-sm hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Retour aux profs
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-primary/15 text-primary font-bold">
            {teacher?.avatar_url ? <img src={teacher.avatar_url} alt="" className="h-full w-full object-cover" /> : (teacher?.full_name ?? "?").charAt(0)}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Réserver un créneau</div>
            <h1 className="text-2xl font-bold tracking-tight">{teacher?.full_name ?? "Professeur"}</h1>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement des créneaux…</p>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">Ce prof n'a pas de créneau publié pour l'instant.</p>
              <p className="mt-1 text-xs text-muted-foreground">Reviens plus tard ou contacte-le en message.</p>
            </div>
          ) : rows.map((r) => {
            const full = r.booked >= r.max_students;
            const mine = bookedIds.has(r.id);
            const isGroup = r.session_type === "group";
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      {r.title ?? r.subject}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1 text-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(r.scheduled_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                      <span>·</span>
                      <span>{r.duration_min} min</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        {isGroup ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                        {isGroup ? `Groupe (${r.booked}/${r.max_students})` : "Solo"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">{Number(r.price_per_student).toLocaleString()} DZD</div>
                      <div className="text-[10px] text-muted-foreground">Paiement en attente</div>
                    </div>
                    {mine ? (
                      <Link to="/live/$sessionId" params={{ sessionId: r.id }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" /> Réservé
                      </Link>
                    ) : (
                      <button
                        disabled={full || busyId === r.id}
                        onClick={() => handleBook(r)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {full ? "Complet" : "Réserver"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}