# Plan de livraison

Ordre validé : **Lot 3 → Refonte IA complète**. Aucun changement Marketplace ni Chargily.

---

## Partie A — Sessions live solo / groupe + quiz temps réel

### A1. Modèle de données (migration)
Ajouts à `live_sessions` :
- `session_mode` (`solo` | `group`)
- `group_capacity` (int, défaut 5)
- `group_price` (int, prix par élève en groupe)
- `solo_price` (int, prix plein solo)
- `status` (`scheduled` | `live` | `ended`)

Nouvelles tables :
- `session_participants` — qui a rejoint, mode choisi, statut connexion, `joined_at`, `left_at`.
- `session_live_quizzes` — quiz envoyé pendant la session : question, options JSON, bonne réponse, `sent_at`, `closed_at`.
- `session_live_answers` — réponse par élève à un quiz live, `is_correct`, `answered_at`.
- `session_summaries` — résumé auto post-session : quiz envoyés, taux réussite global, tableau par élève, points à retravailler (JSON).

RLS : élève voit ses propres participations/réponses ; prof voit tout pour ses sessions ; agrégats visibles aux participants de la session.
Realtime activé sur `session_participants`, `session_live_quizzes`, `session_live_answers`.

### A2. Réservation solo vs groupe
Page fiche session (`/sessions/$sessionId`) :
- Choix explicite Solo (tarif plein) vs Groupe (tarif réduit affiché AVANT réservation).
- Compteur places restantes en Realtime : « 3/5 inscrits ».
- Bouton bloqué quand groupe plein.
- Confirmation → insert dans `session_participants` (paiement branché plus tard sur Chargily existant, hook laissé prêt).

### A3. Écran de session en direct
Route protégée `/live/$sessionId` :
- Zone visio (iframe Daily.co ou placeholder si `DAILY_API_KEY` absent — on ne casse pas si non configuré).
- Panneau latéral prof : composer un quiz express (question + options), envoyer, voir arriver les réponses par élève en Realtime, passer à la question suivante sans quitter l'écran.
- Vue élève : reçoit la question en push, répond, voit son résultat.
- Fin de session (prof clique « Terminer ») → génération auto du résumé (server function IA) stocké dans `session_summaries` et visible aux participants.

### A4. Résumé auto post-session
Server function `summarizeLiveSession` : agrège `session_live_quizzes` + `session_live_answers`, calcule taux réussite par élève, appelle Lovable AI pour extraire les 3 points à retravailler par élève, sauvegarde.

---

## Partie B — Refonte IA conversationnelle complète

### B1. Modèle de données (migration)
- `ai_conversations` : `id`, `student_id`, `title`, `subject`, `level`, `chapter`, `mode` (`chat` | `exam`), `created_at`, `updated_at`.
- `ai_messages` : `id`, `conversation_id`, `role` (`user`/`assistant`), `content`, `image_url` (optionnel, chemin storage `ai-uploads`), `hint_level` (null | 1 | 2 | 3), `created_at`.
- `ai_revision_sheets` : fiche de révision structurée générée à partir d'une conversation.
- `ai_exams` : mode contrôle chronométré — chapitre, durée, questions générées, réponses élève, score final, `finished_at`.
- Historique lisible : SELECT scoped à `student_id`.

### B2. Refonte `/ai` — interface chat AI Elements
- Installation composants AI Elements (`conversation`, `message`, `prompt-input`, `shimmer`, `tool`).
- Chat streaming via server route `/api/chat` (`streamText` + `toUIMessageStreamResponse`).
- Composer avec :
  - Zone texte + envoi d'image (upload dans `ai-uploads`, URL signée passée au modèle en `image_url`).
  - Sélecteur matière / niveau / chapitre (contexte système).
  - Bouton « Indice » avec 3 niveaux progressifs (léger / détaillé / solution).
  - Bouton « Similaire mais + dur » (regénère un exercice basé sur le dernier envoyé).
- Modèle : `google/gemini-3-flash-preview` (multimodal, streaming).
- Mémoire de session : toutes les messages `ai_messages` de la conversation renvoyés à chaque appel.
- Persistance auto : chaque message user + assistant écrit dans `ai_messages` via `onFinish`.

### B3. Historique conversations
Sidebar / page `/ai` avec :
- Liste conversations par matière & date, recherche.
- Route `/ai/$conversationId` — reprend le fil complet.
- Nouvelle conversation → nouvelle ligne + navigation.

### B4. Fiche de révision auto
Bouton « Générer fiche de révision » dans une conversation → server function qui résume la conversation en fiche structurée Markdown (définitions, formules clés, exemples, erreurs fréquentes) → stockée dans `ai_revision_sheets`, consultable depuis un onglet « Mes fiches ».

### B5. Mode « Prépare-moi un contrôle »
Route `/ai/exam/new` :
- Formulaire : matière, chapitre, durée (10/20/30 min), difficulté.
- Génération IA de N questions structurées (JSON via `generateObject` avec schéma simple).
- Écran examen chronométré, une question à la fois, timer visible.
- Fin → correction IA par question + score global sauvegardé dans `ai_exams`.

### B6. Fondations partagées
- Route `/api/chat` (server route TSS, `streamText`, `convertToModelMessages`, `toUIMessageStreamResponse`, `originalMessages`, `onFinish` persist).
- Fichier `src/lib/ai-hints.functions.ts` pour indice progressif et « exercice similaire + dur ».
- Fichier `src/lib/ai-revision.functions.ts` pour fiche de révision & examen.

---

## Ce que je NE fais pas dans ce plan (à faire plus tard, sur demande)
- Refonte Marketplace (Lot 2).
- Idées bonus : progression graphique, notifications intelligentes / répétition espacée, défi entre amis, partage session groupe post-mortem, recommandation croisée cours→IA. À trancher après validation Lot 3 + IA.
- Paiement Chargily (branchement réservation groupe/solo laissé prêt côté DB, activation quand tu le décides).

---

## Détails techniques

- **Migrations DB** en 2 étapes (Partie A, Partie B) — chaque `CREATE TABLE public.*` suivi de `GRANT` + RLS + policies (`auth.uid()` scoping, `has_role('teacher')` pour panneau prof).
- **Realtime** : `ALTER PUBLICATION supabase_realtime ADD TABLE ...` sur les 3 tables live.
- **AI Elements** installés via `bunx ai-elements@latest add conversation message prompt-input shimmer tool`.
- **Streaming chat** : route `src/routes/api/chat.ts` avec `createLovableAiGatewayProvider` existant.
- **Uploads photos exercices** : bucket `ai-uploads` existant, URL signée envoyée au modèle en `image_url` (Gemini multimodal).
- **Daily.co** : intégration graceful — si `DAILY_API_KEY` absent, on affiche un placeholder « Visio bientôt disponible » ; la logique quiz/participants marche indépendamment.
- **Design** : on reste sur le dark theme actuel (teal/amber). Pas de refonte visuelle marketplace ici.

Dis-moi « go » et j'enchaîne Partie A puis Partie B.
