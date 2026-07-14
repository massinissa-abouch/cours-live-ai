// Bilingual dictionary FR/AR — MVP shell scope.
// Add more keys progressively; unknown keys fall back to the FR value.
export type Lang = "fr" | "ar";

export const translations = {
  fr: {
    "lang.french": "Français",
    "lang.arabic": "العربية",
    "lang.switch": "Langue",

    "nav.dashboard": "Tableau de bord",
    "nav.courses": "Cours",
    "nav.tools": "Outils",
    "nav.ai": "Tuteur IA",
    "nav.community": "Communauté",
    "nav.groups": "Groupes",
    "nav.archive": "Archive Bac & BEM",
    "nav.logout": "Déconnexion",
    "nav.notifications": "Notifications",

    "auth.signin": "Se connecter",
    "auth.signup": "Créer un compte",
    "auth.email": "Adresse e-mail",
    "auth.password": "Mot de passe",
    "auth.fullName": "Nom complet",
    "auth.google": "Continuer avec Google",
    "auth.switchToSignup": "Pas encore de compte ? Crée-le",
    "auth.switchToSignin": "Déjà inscrit ? Connecte-toi",

    "dashboard.hello": "Bonjour",
    "dashboard.streak": "jours d'affilée",
    "dashboard.myCourses": "Mes cours",
    "dashboard.mySessions": "Mes séances",
    "dashboard.tools": "Outils",
    "dashboard.viewAll": "Tout voir",

    "tools.homework": "Devoirs",
    "tools.exercises": "Exercices",
    "tools.calculator": "Calculatrice",
    "tools.countdown": "Compte à rebours",
    "tools.memo": "Mémo Express",
    "tools.memo.desc": "Transforme un long cours en fiche facile à retenir",

    "memo.newSheet": "Nouvelle fiche",
    "memo.paste": "Colle ton cours ici",
    "memo.photo": "Photo du cours",
    "memo.generate": "Générer la fiche",
    "memo.simpler": "Encore plus simple",
    "memo.mastered": "Bloc maîtrisé",
    "memo.progress": "blocs appris",

    "ai.newChat": "Nouvelle conversation",
    "ai.placeholder": "Pose ta question…",
    "ai.hint": "Indice",
    "ai.harder": "Exercice plus dur",
    "ai.thinking": "L'IA réfléchit…",

    "common.save": "Enregistrer",
    "common.cancel": "Annuler",
    "common.delete": "Supprimer",
    "common.loading": "Chargement…",
    "common.error": "Une erreur est survenue",
    "common.retry": "Réessayer",
    "common.back": "Retour",
  },
  ar: {
    "lang.french": "Français",
    "lang.arabic": "العربية",
    "lang.switch": "اللغة",

    "nav.dashboard": "لوحة التحكم",
    "nav.courses": "الدروس",
    "nav.tools": "الأدوات",
    "nav.ai": "المدرّس الذكي",
    "nav.community": "المجتمع",
    "nav.groups": "المجموعات",
    "nav.archive": "أرشيف البكالوريا و BEM",
    "nav.logout": "تسجيل الخروج",
    "nav.notifications": "الإشعارات",

    "auth.signin": "تسجيل الدخول",
    "auth.signup": "إنشاء حساب",
    "auth.email": "البريد الإلكتروني",
    "auth.password": "كلمة المرور",
    "auth.fullName": "الاسم الكامل",
    "auth.google": "المتابعة بحساب Google",
    "auth.switchToSignup": "لا تملك حساباً ؟ أنشئه",
    "auth.switchToSignin": "لديك حساب ؟ سجّل الدخول",

    "dashboard.hello": "مرحباً",
    "dashboard.streak": "أيام متتالية",
    "dashboard.myCourses": "دروسي",
    "dashboard.mySessions": "حصصي",
    "dashboard.tools": "الأدوات",
    "dashboard.viewAll": "عرض الكل",

    "tools.homework": "الفروض",
    "tools.exercises": "التمارين",
    "tools.calculator": "الآلة الحاسبة",
    "tools.countdown": "العد التنازلي",
    "tools.memo": "مذكّرة سريعة",
    "tools.memo.desc": "حوّل درساً طويلاً إلى بطاقة سهلة الحفظ",

    "memo.newSheet": "بطاقة جديدة",
    "memo.paste": "الصق درسك هنا",
    "memo.photo": "صورة الدرس",
    "memo.generate": "توليد البطاقة",
    "memo.simpler": "أبسط أكثر",
    "memo.mastered": "أتقنت هذا القسم",
    "memo.progress": "أقسام مُتقنة",

    "ai.newChat": "محادثة جديدة",
    "ai.placeholder": "اطرح سؤالك…",
    "ai.hint": "تلميح",
    "ai.harder": "تمرين أصعب",
    "ai.thinking": "الذكاء الاصطناعي يفكّر…",

    "common.save": "حفظ",
    "common.cancel": "إلغاء",
    "common.delete": "حذف",
    "common.loading": "جاري التحميل…",
    "common.error": "حدث خطأ",
    "common.retry": "إعادة المحاولة",
    "common.back": "رجوع",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["fr"];

export function tr(lang: Lang, key: string): string {
  const dict = translations[lang] as Record<string, string>;
  const fallback = translations.fr as Record<string, string>;
  return dict[key] ?? fallback[key] ?? key;
}

export const LANG_LABEL: Record<Lang, string> = {
  fr: "Français",
  ar: "العربية",
};

export function isRtl(lang: Lang): boolean {
  return lang === "ar";
}