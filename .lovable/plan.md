Tu m'as envoyé 5 gros lots de fonctionnalités d'un coup. Techniquement c'est faisable, mais ça représente ~15-20 nouvelles tables, ~30 nouvelles routes, et une dizaine de flux IA. Le livrer en un seul "go" garantit des régressions et un review impossible. Je te propose de découper en 5 livraisons indépendantes, dans l'ordre de valeur produit.

## Ordre de livraison proposé

**Livraison 1 — Outils élève (Prompt 4)** — base utile immédiatement
- Chat IA curriculum (déjà en place → j'ajoute sélecteur matière/niveau + prompt aligné BEM/BAC officiel)
- Calculateur moyenne BEM & BAC (coefficients officiels par filière, 100% front, pas de DB)
- Compte à rebours examen + checklist chapitres (table `exam_countdowns` existe déjà, à câbler)
- Banque d'exercices par chapitre (QCM instantané + rédigé corrigé IA) — table `ai_exercises` déjà là

**Livraison 2 — Archive Bac & BEM + IA (Prompt 1)**
- Table `exam_archive` (type, année, matière, filière, pdf_url, correction_url)
- Bucket storage `exam-archive` (public read)
- Route `/archive` avec filtres année/matière/type
- Bouton "Aide IA" → ouvre chat contextualisé (matière + année + sujet)
- Note: je ne peux pas fournir les PDFs officiels moi-même. Il faudra soit que tu les uploades, soit que je crée un back-office admin d'upload + un seed d'exemple. → à confirmer

**Livraison 3 — Croissance (Prompt 5)**
- Streak quotidien (table + trigger sur activité)
- Génération image de résultat partageable (canvas côté client → PNG)
- Parrainage: table `referrals` existe → route `/invite` + déblocage 7j après 3 filleuls inscrits

**Livraison 4 — Groupes de révision privés (Prompt 2)**
- Tables `study_groups`, `group_members` (code invitation unique), `group_messages`, `group_resources`, `group_events`, `group_exam_alerts`
- Chat temps réel (Realtime), partage ressources (storage bucket privé au groupe), calendrier
- Annonce contrôle → génération checklist + quiz IA visibles par le groupe
- Mode Pomodoro synchro avec présence live (Realtime presence)

**Livraison 5 — Espace communautaire public (Prompt 3)**
- Tables `community_threads`, `community_posts`, `post_reports`
- Fils par matière×niveau, tri récents/populaires
- Rate limiting (max N messages/heure via check côté serverFn)
- Bouton signalement + queue modération admin
- Pas de DM: enforced par absence de route DM

## Ce que je ne fais PAS
- Aucune modif du système de paiement (Chargily)
- Je ne fabrique pas de faux contenu Bac/BEM (droits + exactitude)

## Détails techniques
- Toutes les tables en RLS scoped `auth.uid()`, GRANT explicites
- Server functions via `createServerFn` + `requireSupabaseAuth`
- IA: on garde le routage hybride actuel (gemini-3.5-flash rapide / gpt-5 puissant)
- Realtime activé uniquement sur `group_messages` et présence Pomodoro

## Ma question
Je démarre par la **Livraison 1 (Outils élève)** qui donne le plus de valeur immédiate à un élève seul sur l'app ? Ou tu préfères commencer par une autre (ex: Archive, si tu as déjà les PDFs prêts à uploader) ?

Réponds-moi simplement "1", "2", "3", "4" ou "5" (ou "1 puis 2" si tu veux enchaîner), et pour l'Archive, dis-moi si tu fournis les PDFs ou si je monte un back-office d'upload admin.