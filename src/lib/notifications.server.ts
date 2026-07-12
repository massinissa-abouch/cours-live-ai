// Server-only helper: creates notifications for any user via the service role
// client, bypassing RLS. Only load from inside server function handlers.

export async function notify(
  userId: string,
  type: string,
  title: string,
  body?: string,
  link?: string,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      type,
      title,
      body: body ?? null,
      link: link ?? null,
    });
  } catch (err) {
    console.error("[notify] failed", err);
  }
}