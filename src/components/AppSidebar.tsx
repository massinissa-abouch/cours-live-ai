import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sparkles,
  LayoutDashboard,
  BookOpen,
  Library,
  Video,
  Users,
  MessageSquare,
  Wrench,
  Archive,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

type NavItem = {
  title: string;
  url:
    | "/dashboard"
    | "/courses"
    | "/library"
    | "/teachers"
    | "/ai"
    | "/tools"
    | "/archive"
    | "/groups"
    | "/community"
    | "/teacher"
    | "/admin";
  icon: typeof LayoutDashboard;
};

const primary: NavItem[] = [
  { title: "Accueil", url: "/dashboard", icon: LayoutDashboard },
  { title: "Tuteur IA", url: "/ai", icon: Sparkles },
  { title: "Programme officiel", url: "/library", icon: Library },
  { title: "Cours de profs", url: "/courses", icon: BookOpen },
  { title: "Profs en direct", url: "/teachers", icon: Video },
  { title: "Outils", url: "/tools", icon: Wrench },
];

const community: NavItem[] = [
  { title: "Groupes", url: "/groups", icon: Users },
  { title: "Communauté", url: "/community", icon: MessageSquare },
  { title: "Archive BAC & BEM", url: "/archive", icon: Archive },
];

export function AppSidebar({ userId }: { userId: string }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => currentPath === url || currentPath.startsWith(url + "/");

  const [isTeacher, setIsTeacher] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const roles = (data ?? []).map((r) => r.role as string);
      setIsTeacher(roles.includes("teacher"));
      setIsAdmin(roles.includes("admin"));
    })();
  }, [userId]);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60">
      <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-4">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-gradient text-primary-foreground font-bold shadow-glow">
            أ
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-base font-bold tracking-tight">Estadi</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Compagnon scolaire
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-1">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Apprendre</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {primary.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Communauté</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {community.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(isTeacher || isAdmin) && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Espaces pro</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {isTeacher && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/teacher")} tooltip="Espace prof">
                      <Link to="/teacher" className="flex items-center gap-3">
                        <GraduationCap className="h-4 w-4 shrink-0" />
                        <span>Espace prof</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/admin")} tooltip="Admin">
                      <Link to="/admin" className="flex items-center gap-3">
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        <span>Admin</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 p-3">
        {!collapsed && (
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs">
            <div className="font-semibold text-primary">Estadi Premium</div>
            <div className="mt-0.5 text-muted-foreground">
              Invite 3 amis pour débloquer 7 jours illimités.
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}