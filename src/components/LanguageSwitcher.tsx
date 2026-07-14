import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import type { Lang } from "@/lib/i18n/translations";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  const next: Lang = lang === "fr" ? "ar" : "fr";
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
      aria-label={`Passer en ${next === "ar" ? "العربية" : "Français"}`}
      title={next === "ar" ? "العربية" : "Français"}
    >
      <Languages className="h-3.5 w-3.5" />
      {compact ? (lang === "fr" ? "FR" : "AR") : lang === "fr" ? "FR · العربية" : "AR · Français"}
    </button>
  );
}