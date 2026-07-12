import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GraduationCap, Users, Sparkles, Upload, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

type Role = "student" | "teacher" | "parent";
type Level = "primaire" | "cem_1" | "cem_2" | "cem_3" | "cem_4"
  | "lycee_1_tc" | "lycee_2_sciences" | "lycee_2_lettres" | "lycee_2_maths"
  | "lycee_2_gestion" | "lycee_2_langues" | "lycee_2_techmath"
  | "lycee_3_sciences" | "lycee_3_lettres" | "lycee_3_maths"
  | "lycee_3_gestion" | "lycee_3_langues" | "lycee_3_techmath"
  | "univ_1" | "univ_2" | "univ_3" | "autre";

const LEVELS: { value: Level; label: string; group: string }[] = [
  { value: "primaire", label: "Primaire", group: "Primaire" },
  { value: "cem_1", label: "1ère année moyenne", group: "CEM" },
  { value: "cem_2", label: "2e année moyenne", group: "CEM" },
  { value: "cem_3", label: "3e année moyenne", group: "CEM" },
  { value: "cem_4", label: "4e année moyenne (BEM)", group: "CEM" },
  { value: "lycee_1_tc", label: "1ère année lycée (Tronc commun)", group: "Lycée" },
  { value: "lycee_2_sciences", label: "2e Sciences expérimentales", group: "Lycée" },
  { value: "lycee_2_maths", label: "2e Mathématiques", group: "Lycée" },
  { value: "lycee_2_techmath", label: "2e Technique-Math", group: "Lycée" },
  { value: "lycee_2_lettres", label: "2e Lettres & philosophie", group: "Lycée" },
  { value: "lycee_2_gestion", label: "2e Gestion & économie", group: "Lycée" },
  { value: "lycee_2_langues", label: "2e Langues étrangères", group: "Lycée" },
  { value: "lycee_3_sciences", label: "3e Sciences expérimentales (BAC)", group: "Lycée" },
  { value: "lycee_3_maths", label: "3e Mathématiques (BAC)", group: "Lycée" },
  { value: "lycee_3_techmath", label: "3e Technique-Math (BAC)", group: "Lycée" },
  { value: "lycee_3_lettres", label: "3e Lettres & philosophie (BAC)", group: "Lycée" },
  { value: "lycee_3_gestion", label: "3e Gestion & économie (BAC)", group: "Lycée" },
  { value: "lycee_3_langues", label: "3e Langues étrangères (BAC)", group: "Lycée" },
  { value: "univ_1", label: "L1 Université", group: "Université" },
  { value: "univ_2", label: "L2 Université", group: "Université" },
  { value: "univ_3", label: "L3 Université", group: "Université" },
  { value: "autre", label: "Autre", group: "Autre" },
];

function Onboarding() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("student");
  const [level, setLevel] = useState<Level>("lycee_3_sciences");
  const [exam, setExam] = useState<"none" | "bem" | "bac">("bac");
  const [wilaya, setWilaya] = useState("");
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState("");
  const [hourlyRate, setHourlyRate] = useState(1500);
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [diploma, setDiploma] = useState<File | null>(null);

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if ((roles ?? []).some((r) => r.role === "teacher")) setRole("teacher");
    })();
  }, [user.id]);

  async function uploadDoc(file: File, kind: string) {
    const path = `${user.id}/${kind}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("teacher-docs").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Ensure role
      if (role !== "student") {
        await supabase.from("user_roles").upsert({ user_id: user.id, role }, { onConflict: "user_id,role" });
      }
      // Save wilaya
      if (wilaya) {
        await supabase.from("profiles").update({ wilaya }).eq("id", user.id);
      }
      // Save student level & exam
      await supabase
        .from("student_profiles")
        .upsert({ user_id: user.id, school_level: level, exam_target: exam });

      if (role === "teacher") {
        const idPath = idDoc ? await uploadDoc(idDoc, "id") : undefined;
        const diplomaPath = diploma ? await uploadDoc(diploma, "diploma") : undefined;
        await supabase
          .from("teacher_profiles")
          .upsert({
            user_id: user.id,
            subjects: subjects.split(",").map((s) => s.trim()).filter(Boolean),
            levels: [level],
            hourly_rate: hourlyRate,
            id_document_url: idPath ?? null,
            diploma_url: diplomaPath ?? null,
            verification_status: "pending",
          });
        navigate({ to: "/teacher" });
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Bienvenue sur Ostadi 👋</h1>
        <p className="mt-2 text-muted-foreground">Réponds à 3 questions pour personnaliser ton expérience.</p>

        <form onSubmit={submit} className="mt-8 space-y-8">
          <section>
            <label className="text-sm font-semibold">Je suis…</label>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {([
                { v: "student" as Role, icon: GraduationCap, label: "Élève / Étudiant" },
                { v: "teacher" as Role, icon: Sparkles, label: "Prof" },
                { v: "parent" as Role, icon: Users, label: "Parent" },
              ]).map((o) => (
                <button type="button" key={o.v} onClick={() => setRole(o.v)}
                  className={`rounded-xl border p-4 text-left transition ${role === o.v ? "border-primary bg-secondary" : "border-border hover:bg-secondary/50"}`}>
                  <o.icon className="h-5 w-5 text-primary" />
                  <div className="mt-2 text-sm font-medium">{o.label}</div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <label className="text-sm font-semibold">
              {role === "parent" ? "Niveau de ton enfant" : role === "teacher" ? "Niveau principal enseigné" : "Ton niveau scolaire"}
            </label>
            <select value={level} onChange={(e) => setLevel(e.target.value as Level)}
              className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm">
              {["Primaire", "CEM", "Lycée", "Université", "Autre"].map((g) => (
                <optgroup key={g} label={g}>
                  {LEVELS.filter((l) => l.group === g).map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </section>

          <section>
            <label className="text-sm font-semibold">Examen visé</label>
            <div className="mt-3 flex gap-2">
              {(["none", "bem", "bac"] as const).map((v) => (
                <button type="button" key={v} onClick={() => setExam(v)}
                  className={`rounded-lg border px-4 py-2 text-sm ${exam === v ? "border-primary bg-secondary" : "border-border"}`}>
                  {v === "none" ? "Aucun" : v.toUpperCase()}
                </button>
              ))}
            </div>
          </section>

          <section>
            <label className="text-sm font-semibold">Wilaya (optionnel)</label>
            <input value={wilaya} onChange={(e) => setWilaya(e.target.value)} placeholder="Alger, Oran, Constantine…"
              className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm" />
          </section>

          <button type="submit" disabled={saving}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-90 disabled:opacity-60">
            {saving ? "..." : "Continuer"}
          </button>
        </form>
      </div>
    </div>
  );
}