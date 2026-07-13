import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(ctx: { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Réservé aux administrateurs.");
}

const EntryInput = z.object({
  id: z.string().uuid().optional(),
  exam_type: z.enum(["bem", "bac"]),
  year: z.number().int().min(2000).max(2100),
  subject: z.string().min(1).max(80),
  filiere: z.string().max(80).optional().nullable(),
  title: z.string().min(1).max(160),
  pdf_path: z.string().min(1).max(500),
  correction_path: z.string().max(500).optional().nullable(),
});

export const saveArchiveEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => EntryInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const payload = {
      exam_type: data.exam_type,
      year: data.year,
      subject: data.subject,
      filiere: data.filiere ?? null,
      title: data.title,
      pdf_url: data.pdf_path,
      correction_url: data.correction_path ?? null,
      uploaded_by: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase.from("exam_archive").update(payload).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase.from("exam_archive").insert(payload).select("id").single();
    if (error) throw error;
    return { id: row.id as string };
  });

export const deleteArchiveEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: row } = await context.supabase
      .from("exam_archive").select("pdf_url,correction_url").eq("id", data.id).maybeSingle();
    if (row) {
      const paths = [row.pdf_url, row.correction_url].filter((p): p is string => !!p);
      if (paths.length) await context.supabase.storage.from("exam-archive").remove(paths);
    }
    const { error } = await context.supabase.from("exam_archive").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const signArchiveUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ ext: z.string().max(8) }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const clean = data.ext.replace(/[^a-z0-9]/gi, "") || "pdf";
    const path = `${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${clean}`;
    const { data: sig, error } = await context.supabase.storage
      .from("exam-archive").createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: sig.token, signedUrl: sig.signedUrl };
  });

export const signArchiveRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ path: z.string().min(1).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: sig, error } = await context.supabase.storage
      .from("exam-archive").createSignedUrl(data.path, 3600);
    if (error) throw error;
    return { signedUrl: sig.signedUrl };
  });