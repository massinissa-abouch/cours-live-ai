import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { tr, isRtl, type Lang } from "./translations";

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
};

const Ctx = createContext<I18nCtx | null>(null);

const STORAGE_KEY = "ostadi_lang";

function readInitial(): Lang {
  if (typeof window === "undefined") return "fr";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "ar" ? "ar" : "fr";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default to "fr" on both SSR and first client paint to avoid hydration mismatch;
  // hop to the persisted value in an effect right after mount.
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    const initial = readInitial();
    if (initial !== "fr") setLangState(initial);
    // Sync from DB when user is signed in (overrides localStorage).
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase
        .from("student_profiles")
        .select("preferred_language")
        .eq("user_id", uid)
        .maybeSingle();
      const dbLang = prof?.preferred_language === "ar" ? "ar" : prof?.preferred_language === "fr" ? "fr" : null;
      if (dbLang && dbLang !== initial) setLangState(dbLang);
    })();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, l);
    // Persist to DB (best-effort)
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      await supabase.from("student_profiles").update({ preferred_language: l }).eq("user_id", uid);
    })();
  }, []);

  const value = useMemo<I18nCtx>(() => ({
    lang,
    setLang,
    t: (key: string) => tr(lang, key),
    dir: isRtl(lang) ? "rtl" : "ltr",
  }), [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>");
  return ctx;
}

export function useT() {
  return useI18n().t;
}