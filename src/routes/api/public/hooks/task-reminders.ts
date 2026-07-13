import { createFileRoute } from "@tanstack/react-router";

type Tier = "d3" | "d1" | "d0" | "overdue";

function tierFor(dueAt: string): Tier | null {
  const diffH = (new Date(dueAt).getTime() - Date.now()) / 3_600_000;
  if (diffH <= 0) return "overdue";
  if (diffH <= 8) return "d0";
  if (diffH <= 30) return "d1";
  if (diffH <= 78) return "d3";
  return null;
}

function labelFor(tier: Tier): { emoji: string; head: string } {
  if (tier === "overdue") return { emoji: "🚨", head: "En retard" };
  if (tier === "d0") return { emoji: "⏰", head: "À rendre aujourd'hui" };
  if (tier === "d1") return { emoji: "⚡", head: "À rendre demain" };
  return { emoji: "📌", head: "À rendre dans 3 jours" };
}

export const Route = createFileRoute("/api/public/hooks/task-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Fenêtre : tâches ouvertes avec échéance dans les 4 jours ou déjà en retard (72h de rattrapage)
        const in4d = new Date(Date.now() + 4 * 86_400_000).toISOString();
        const overdueFloor = new Date(Date.now() - 3 * 86_400_000).toISOString();

        const { data: tasks, error } = await supabaseAdmin
          .from("student_tasks")
          .select("id,student_id,title,subject,due_at,channels,priority_score")
          .in("status", ["todo", "in_progress"])
          .not("due_at", "is", null)
          .lte("due_at", in4d)
          .gte("due_at", overdueFloor);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let created = 0;
        for (const t of tasks ?? []) {
          if (!t.due_at) continue;
          const tier = tierFor(t.due_at);
          if (!tier) continue;

          // Dédup (task_id + tier + channel=inapp)
          const { data: already } = await supabaseAdmin
            .from("task_reminder_log")
            .select("id")
            .eq("task_id", t.id)
            .eq("tier", tier)
            .eq("channel", "inapp")
            .maybeSingle();
          if (already) continue;

          const { emoji, head } = labelFor(tier);
          const bodyText = t.subject ? `${t.subject} · ${t.title}` : t.title;

          await supabaseAdmin.from("notifications").insert({
            user_id: t.student_id,
            type: "task_reminder",
            title: `${emoji} ${head}`,
            body: bodyText,
            link: `/tools/homework?task=${t.id}`,
          });
          await supabaseAdmin.from("task_reminder_log").insert({
            task_id: t.id,
            student_id: t.student_id,
            tier,
            channel: "inapp",
          });
          created++;
        }

        return Response.json({ ok: true, scanned: tasks?.length ?? 0, created });
      },
    },
  },
});