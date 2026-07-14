import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      // Prefer the local session — no network round-trip, no failure mode.
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        return { user: sessionData.session.user };
      }
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/auth" });
      return { user: data.user };
    } catch (e) {
      // Never surface auth transport errors as a full-app crash — redirect to /auth.
      if (e && typeof e === "object" && "isRedirect" in e) throw e;
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});