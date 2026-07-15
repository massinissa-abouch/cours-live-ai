# Refonte Estadi — plan en 4 vagues

## Pourquoi pas "tout d'un coup"

Ton prompt couvre 17 espaces, ~40 tables, une refonte design complète et de la génération IA de contenu. Livré en une seule fois, ça veut dire :
- Des milliers de lignes de code touchées en une passe → bugs garantis sur l'existant (IA, groupes, communauté, outils qui marchent aujourd'hui).
- Impossible à tester / valider pour toi entre chaque étape.
- Un coût IA imprévisible si on lance la génération auto sur 116 chapitres × 6 artefacts (résumé/flashcards/quiz…).
- Beaucoup de features existent déjà — les refaire = régression, pas progrès.

Je livre donc **par vagues courtes** (chacune testable et déployable), en réutilisant l'existant.

## Vague 1 — Design system Émeraude & Nuit + refonte du shell (MAINTENANT)

Objectif : donner à Estadi une identité visuelle premium (Apple/Linear feel), sans toucher à la logique métier.

- **Design tokens** dans `src/styles.css` : palette Émeraude `#10B981` (primary) / Nuit `#0B1220` (bg dark) / Blanc cassé `#F8FAFC` / Ambre `#F59E0B` (accent), en oklch. Mode sombre par défaut, mode clair soigné. Ombres, gradients, radii premium.
- **Typo** : Inter Tight (titres) + Inter (corps), chargée dans `__root.tsx`.
- **Nouveau shell d'app authentifié** : sidebar collapsible (shadcn Sidebar) avec sections Accueil / Cours / IA / Révisions / BAC & BEM / Communauté / Outils / Profil, header sticky avec streak+XP+notifs, breadcrumb, layout responsive mobile-first.
- **Dashboard repensé** : hero "Bonjour X" + progression du jour + planning IA + streak + prochaines sessions + recommandations, cards en bento-grid avec Framer Motion (fade/scale au mount, hover-lift). Les données affichées viennent des tables existantes (gamification, bookings, enrollments, notifications).
- **Ajustement des pages existantes** (cours, IA, outils, groupes, communauté, archive) pour utiliser les nouveaux tokens — aucune refonte fonctionnelle.

Livrable : app visuellement premium, cohérente clair/sombre, sans régression.

## Vague 2 — Bibliothèque de cours officielle (structure + génération IA à la demande)

- Nouvelles tables : `subjects`, `chapters` (déjà partiel dans `curriculum`), `lessons`, `lesson_variants` (résumé 5min / 1min / complet), `flashcards`, `quizzes`, `quiz_questions`, `exercises`, `exercise_solutions`. GRANTs + RLS (lecture publique authentifiée, écriture prof/admin).
- Seed structurel : hiérarchie Primaire → CEM → Lycée (1AS/2AS/3AS × 6 filières) + chapitres officiels (extension du seed curriculum existant).
- Pages : `/library`, `/library/$level`, `/library/$level/$subject`, `/library/$level/$subject/$chapter` avec onglets (Cours / Résumé / Flashcards / Quiz / Exercices / Annales liées).
- **Génération IA à la demande** (pas en masse) : bouton "Générer avec l'IA" sur un chapitre, qui appelle une server function utilisant `google/gemini-3-flash-preview` avec le contexte curriculum + niveau, et persiste le résultat. Cache DB pour ne payer qu'une fois par chapitre.
- Coût cadré : je n'auto-génère RIEN au déploiement — c'est toi ou tes profs qui déclenchez la génération chapitre par chapitre depuis l'admin.

## Vague 3 — Orientation post-BAC + universités algériennes

- Tables : `universities` (nom, wilaya, type, présentation), `majors` (spécialité, université, seuils d'admission par année, débouchés, durée, salaire moyen).
- Simulateur : l'élève entre moyenne + filière + wilaya → liste des universités/spécialités accessibles, triées par pertinence.
- Pages fiche université / fiche spécialité avec photos, transport, résidences, journées portes ouvertes.
- Seed initial minimal (grandes universités) — extensible par admin.

## Vague 4 — Gamification avancée + statistiques

- XP par action (leçon terminée, quiz réussi, exercice corrigé, streak) — étend la table `gamification` existante.
- Badges, niveaux, classements (national / wilaya / école) via une nouvelle table `leaderboards` matérialisée.
- Défis quotidiens/hebdo générés par un cron sur `/api/public/hooks/`.
- Page stats : graphiques (recharts) évolution, moyenne, points forts/faibles, prévision BAC/BEM basée sur historique de quiz.

## Ce que je NE fais pas (à cadrer plus tard, pas dans ce plan)

- Espace Parent avancé (déjà partiel via `parent_child_links`).
- Espace Enseignant refondu (déjà fonctionnel).
- Scanner IA dédié (déjà couvert par le chat IA multimodal existant + cahier de textes).
- Téléchargement hors ligne / PWA — feature à part entière.
- Recherche vocale, mode concentration — polish à faire une fois le socle stable.

## Question de validation

Confirme que je pars sur la **Vague 1 uniquement** en premier (design system + shell + dashboard). Une fois validée visuellement par toi en preview, on enchaîne sur la Vague 2.

Si tu veux vraiment tout d'un coup malgré le risque, dis-le explicitement et je le ferai — mais ce sera long, moins soigné, et tu ne pourras pas donner de feedback intermédiaire.
