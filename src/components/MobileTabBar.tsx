import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Sparkles, Library, Video, Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

const tabs = [
  { title: "Accueil", url: "/dashboard" as const, icon: Home },
  { title: "IA", url: "/ai" as const, icon: Sparkles },
  { title: "Cours", url: "/library" as const, icon: Library },
  { title: "Profs", url: "/teachers" as const, icon: Video },
];

export function MobileTabBar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { toggleSidebar } = useSidebar();
  const isActive = (u: string) => path === u || path.startsWith(u + "/");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigation principale"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map((t) => {
          const active = isActive(t.url);
          return (
            <li key={t.url} className="flex">
              <Link
                to={t.url}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`grid h-8 w-12 place-items-center rounded-xl transition ${
                    active ? "bg-primary/15 text-primary" : ""
                  }`}
                >
                  <t.icon className="h-[18px] w-[18px]" />
                </span>
                <span>{t.title}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex">
          <button
            onClick={toggleSidebar}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground"
            aria-label="Ouvrir le menu"
          >
            <span className="grid h-8 w-12 place-items-center rounded-xl">
              <Menu className="h-[18px] w-[18px]" />
            </span>
            <span>Plus</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}