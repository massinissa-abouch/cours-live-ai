## Objectif

Rendre l'app réellement fonctionnelle (hors paiement Chargily) : la réservation live, l'upload prof, la publication de cours, la lecture des vidéos, la visio Daily.co, les notifications, le tableau de bord et confirmer que le module IA est bien connecté.

## Livrables

### 1. Réservation live (priorité)

- Nouvelle page `sessions.book.$teacherId.tsx` : liste les `live_sessions` à venir du prof (créneaux publiés) et permet de réserver en 1 clic. Bouton "Réserver un créneau" sur `/teachers` → route vers cette page (plus d'`alert`).
- Server function `bookSession` (déjà partielle) élargie : vérifie créneau futur, places restantes (solo=1, group=max 5), empêche double-booking, insère `session_bookings` (status `booked`, mode déduit du type), crée notifications in-app pour élève + prof, renvoie `sessionId` pour redirection.
- Server fn `cancelBooking` (élève ou prof) qui passe le booking à `cancelled` et notifie.
- Statuts créneau réels : trigger SQL/fn qui recalcule `live_sessions.status` (`scheduled` → `full` quand plein → `completed` après end time via cron logique côté lecture).

### 2. Visio Daily.co

- Server fn `getOrCreateDailyRoom(sessionId)` : appelée par prof/élève quand session à ≤15 min de scheduled_at. Utilise secret `DAILY_API_KEY` pour créer une room privée (expire à scheduled_at + duration + 30 min), enregistre `daily_room_url` sur la session, renvoie l'URL. Idempotent.
- Page `_authenticated/live.$sessionId.tsx` : bouton "Rejoindre" actif seulement à partir de T-15min ; embed `<iframe src={daily_room_url}>` une fois cliqué. Quiz temps réel prof→élèves déjà en place — vérifier Realtime OK.
- Ajouter secret via `add_secret` si `DAILY_API_KEY` n'existe pas encore (le user dit "déjà configurée" — je vérifierai avec `fetch_secrets`).

### 3. Auth & profils

- `auth.tsx` : après `signUp`, ne pas rediriger si `data.session === null` (email de confirmation en attente) → afficher message "Vérifie ton email".
- `onboarding.tsx` : distinguer étudiant vs prof (rôle choisi à l'inscription via `?role=teacher`), déclencher création `teacher_profiles` + insertion `user_roles=teacher`, upload réel de la CIN et diplôme dans bucket `teacher-docs` (déjà présent), passer `verification_status='pending'`. Afficher badge statut sur dashboard prof.

### 4. Marketplace cours

- `teacher.courses.new.tsx` : upload réel trailer + N vidéos dans bucket `course-media` (déjà là), insert `courses` (status `published`), insert `course_videos` (position, is_free_preview, video_url).
- `courses.$courseId.tsx` : bouton "S'inscrire" → server fn `enrollCourse` qui insère `course_enrollments` (payment_id null, auto-validé), incrémente `enrolled_count`. Vidéos non-preview accessibles seulement si enrolled (URL signée via `supabaseAdmin.storage.from('course-media').createSignedUrl` côté server fn `getCourseVideoUrl`).

### 5. Notifications in-app

- Server fns créent des lignes `notifications` (réservation confirmée, session à venir, inscription cours, vérif prof).
- Cloche dans le header du dashboard listant les non-lues, marquer lu au clic.

### 6. Tableau de bord

- `dashboard.tsx` élève : sections "Cours en cours" (join course_enrollments+courses), "Sessions à venir" (session_bookings status=booked + live_sessions futur), "Sessions passées".
- `teacher.index.tsx` : sections "Mes cours publiés", "Créneaux publiés" (link vers availability), "Réservations à venir", "Élèves" (distinct student_ids).

### 7. Module IA — vérifier fonctionnel

Le streaming AI chat est déjà branché sur `LOVABLE_API_KEY` avec contexte persistant (`ai_conversations` + `ai_messages`). Rapide sanity check ; corriger si le stream ne s'affiche pas.

## Ce qui est hors scope

- Paiement Chargily (l'inscription/réservation sont auto-validées).
- Emails transactionnels (on utilise notifications in-app ; email si le domaine est déjà scaffoldé — sinon on note pour plus tard).

## Migration SQL nécessaire

Une seule migration : politiques RLS manquantes sur inserts/reads si besoin, GRANT storage sur buckets teacher-docs / course-media, index `session_bookings(session_id, status)`, éventuel trigger updated_at.

## Ordre d'implémentation

1. Migration + secrets (`DAILY_API_KEY` vérifié).
2. Réservation bout-en-bout (server fn + page de booking + suppression alert).
3. Visio Daily (server fn + intégration page live).
4. Marketplace : publication cours + inscription + lecture vidéo signée.
5. Auth confirmation email + onboarding prof avec upload.
6. Notifications + dashboards.
7. Test rapide IA chat.

## Détails techniques

- Utilise `createServerFn` + `requireSupabaseAuth` partout, jamais d'Edge Function.
- Uploads via `supabase.storage` côté client avec le token utilisateur (buckets privés, policies restreintes).
- URLs vidéo servies via server fn qui vérifie enrollment puis renvoie une signed URL courte (1h).
- Daily.co room via `fetch` HTTPS depuis le server fn (pas de SDK Node).
- Toutes les mutations invalidate les queries clés côté React Query.
