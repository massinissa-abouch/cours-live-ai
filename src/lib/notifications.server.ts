import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export async function notify(
  supabase: Client,
  userId: string,
  type: string,
  title: string,
  body?: string,
  link?: string,
) {
  try {
    await supabase.from("notifications").insert({
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