import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Users, User, Clock, Calendar, Video, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSessionDetail, bookSession, getPublicSessionPreview } from "@/lib/live-session.functions";

export const Route = createFileRoute("/sessions/$sessionId")({
  component: SessionDetail,
});

type Session = {
  id: string;
  title: string | null;
  subject: string;
  scheduled_at: string;
  duration_min: number;
  session_type: "solo" | "group";
  max_students: number;
  price_per_student: number;
  status: "scheduled" | "live" | "completed" | "cancelled";
};

function SessionDetail() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const load = useServerFn(getSessionDetail);
  const book = useServerFn(bookSession);
  const loadPublic = useServerFn(getPublicSessionPreview);

  const [session, setSession] = useState<Session | null>(null);
  const [bookedCount, setBookedCount] = useState(0);
  const [myBooking, setMyBooking] = useState<{ id: string; mode: string; status: string } | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [mode, setMode] = useState<"solo" | "group">("solo");
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  async function refresh() {
    try {
      const res = await load({ data: { id: sessionId } });
      setSession(res.session as Session);
      setBookedCount(res.bookedCount);
      setMyBooking(res.myBooking);
      setIsTeacher(res.isTeacher);
      if ((res.session as Session).session_type === "group") setMode("group");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  useEffect(() => {
    if (authed === null) return;
    if (authed) {
      refresh();
    } else {
      loadPublic({ data: { id: sessionId } })
        .then((res) => {
          if (res?.session) {
            setSession(res.session as Session);
            setBookedCount(res.bookedCount);
          }
        })
        .catch((e) => toast.error(e instanceof Error ? e.message : "Erreur"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, authed]);

  // Realtime seat counter
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`session-${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_bookings", filter: `session_id=eq.${session.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  async function onBook() {
    setLoading(true);
    try {
      const res = await book({ data: { sessionId, mode } });
      toast.success("Réservation enregistrée ✓");
      await refresh();
      if (res.sessionId) navigate({ to: "/live/$sessionId", params: { sessionId: res.sessionId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (!session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const soloPrice = session.price_per_student;
  const groupPrice = Math.round(soloPrice * 0.6);
  const isGroup = session.session_type === "group";
  const capacity = session.max_students;
  const seatsLeft = Math.max(0, capacity - bookedCount);
  const isFull = seatsLeft === 0;
  const dt = new Date(session.scheduled_at);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-4">
          <Link to="/teachers" className="flex items-center gap-2 text-sm hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{session.subject}</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{session.title ?? `Session ${session.subject}`}</h1>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard icon={<Calendar className="h-4 w-4" />} label="Date" value={dt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} />
              <InfoCard icon={<Clock className="h-4 w-4" />} label="Horaire" value={`${dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · ${session.duration_min} min`} />
            </div>

            {isGroup && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4 text-primary" /> Session en groupe
                  </div>
                  <div className="text-sm">
                    <span className={`font-bold ${isFull ? "text-destructive" : "text-primary"}`}>{bookedCount}/{capacity}</span>{" "}
                    <span className="text-muted-foreground">inscrits</span>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary transition-all" style={{ width: `${(bookedCount / capacity) * 100}%` }} />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {isFull ? "Session complète" : `${seatsLeft} place${seatsLeft > 1 ? "s" : ""} restante${seatsLeft > 1 ? "s" : ""}`}
                </div>
              </div>
            )}

            {myBooking && (myBooking.status === "booked" || myBooking.status === "attended") && (
              <button
                onClick={() => navigate({ to: "/live/$sessionId", params: { sessionId } })}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-bold text-primary-foreground">
                <Video className="h-4 w-4" /> Aller à la salle de session
              </button>
            )}
          </div>

          <aside className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            {isTeacher ? (
              <div className="text-sm text-muted-foreground">
                Vous êtes l'enseignant de cette session.
                <Link to="/live/$sessionId" params={{ sessionId }} className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  Ouvrir la salle
                </Link>
              </div>
            ) : myBooking ? (
              <div>
                <div className="rounded-xl bg-primary/10 p-3 text-sm text-primary">
                  ✓ Tu es inscrit ({myBooking.mode})
                </div>
                <div className="mt-3 text-xs text-muted-foreground">Statut : {myBooking.status}</div>
              </div>
            ) : authed === false ? (
              <div className="text-sm">
                <Link to="/auth" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
                  Se connecter pour réserver
                </Link>
              </div>
            ) : (
              <>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Choisis ta formule</div>
                <div className="mt-3 space-y-2">
                  <ModeOption
                    active={mode === "solo"}
                    onClick={() => setMode("solo")}
                    icon={<User className="h-4 w-4" />}
                    title="Solo — tarif plein"
                    subtitle="Session privée 1-1 avec le prof"
                    price={soloPrice}
                    disabled={isGroup}
                  />
                  <ModeOption
                    active={mode === "group"}
                    onClick={() => setMode("group")}
                    icon={<Users className="h-4 w-4" />}
                    title={`Groupe (jusqu'à ${capacity})`}
                    subtitle={`Tarif réduit · ${seatsLeft} place${seatsLeft > 1 ? "s" : ""} restante${seatsLeft > 1 ? "s" : ""}`}
                    price={groupPrice}
                    disabled={!isGroup || isFull}
                  />
                </div>
                <div className="mt-4 rounded-xl bg-secondary/50 p-3 text-center">
                  <div className="text-3xl font-bold text-primary">
                    {mode === "solo" ? soloPrice : groupPrice} <span className="text-sm text-muted-foreground">DZD</span>
                  </div>
                </div>
                <button
                  onClick={onBook}
                  disabled={loading || (mode === "group" && isFull)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] disabled:opacity-50">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Réserver ma place"}
                </button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">Paiement à confirmer avec le prof.</p>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
      <div className="mt-1 font-semibold capitalize">{value}</div>
    </div>
  );
}

function ModeOption({ active, onClick, icon, title, subtitle, price, disabled }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string; price: number; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition disabled:opacity-40 ${
        active ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
      }`}>
      <div className={`grid h-9 w-9 place-items-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
      <div className="text-sm font-bold">{price}<span className="text-[10px] text-muted-foreground"> DZD</span></div>
    </button>
  );
}
