-- 1. Curriculum table
CREATE TABLE public.curriculum (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL,
  filiere text,
  subject text NOT NULL,
  chapter_order int NOT NULL,
  chapter_title_fr text NOT NULL,
  chapter_title_ar text,
  keywords text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.curriculum TO authenticated, anon;
GRANT ALL ON public.curriculum TO service_role;

ALTER TABLE public.curriculum ENABLE ROW LEVEL SECURITY;

CREATE POLICY "curriculum readable by everyone" ON public.curriculum
  FOR SELECT TO authenticated, anon USING (true);

CREATE INDEX idx_curriculum_lookup ON public.curriculum(level, subject, filiere);
CREATE UNIQUE INDEX idx_curriculum_unique ON public.curriculum(level, COALESCE(filiere,''), subject, chapter_order);

-- 2. Preferred language on student profiles
ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'fr'
  CHECK (preferred_language IN ('fr','ar'));

-- 3. Seed baseline curriculum
INSERT INTO public.curriculum (level, filiere, subject, chapter_order, chapter_title_fr, chapter_title_ar) VALUES
-- BEM 4AM Mathématiques
('cem_4', NULL, 'mathematiques', 1, 'Nombres relatifs et opérations', 'الأعداد النسبية والعمليات'),
('cem_4', NULL, 'mathematiques', 2, 'Calcul littéral et développement', 'الحساب الحرفي والنشر'),
('cem_4', NULL, 'mathematiques', 3, 'Racines carrées', 'الجذور التربيعية'),
('cem_4', NULL, 'mathematiques', 4, 'Théorème de Thalès', 'مبرهنة طاليس'),
('cem_4', NULL, 'mathematiques', 5, 'Théorème de Pythagore et trigonométrie', 'مبرهنة فيثاغورس وحساب المثلثات'),
('cem_4', NULL, 'mathematiques', 6, 'Équations et inéquations du premier degré', 'المعادلات والمتراجحات من الدرجة الأولى'),
('cem_4', NULL, 'mathematiques', 7, 'Systèmes d''équations', 'جمل المعادلات'),
('cem_4', NULL, 'mathematiques', 8, 'Fonctions linéaires et affines', 'الدوال الخطية والتآلفية'),
('cem_4', NULL, 'mathematiques', 9, 'Statistiques', 'الإحصاء'),
('cem_4', NULL, 'mathematiques', 10, 'Géométrie dans l''espace', 'الهندسة في الفضاء'),

-- BEM 4AM Physique-Chimie
('cem_4', NULL, 'physique', 1, 'Énergie électrique et puissance', 'الطاقة الكهربائية والاستطاعة'),
('cem_4', NULL, 'physique', 2, 'Loi d''Ohm et résistance', 'قانون أوم والمقاومة'),
('cem_4', NULL, 'physique', 3, 'Réactions chimiques', 'التفاعلات الكيميائية'),
('cem_4', NULL, 'physique', 4, 'Atomes et molécules', 'الذرات والجزيئات'),
('cem_4', NULL, 'physique', 5, 'Mouvement et vitesse', 'الحركة والسرعة'),

-- BEM 4AM SVT
('cem_4', NULL, 'svt', 1, 'Système nerveux', 'الجهاز العصبي'),
('cem_4', NULL, 'svt', 2, 'Reproduction humaine', 'التكاثر عند الإنسان'),
('cem_4', NULL, 'svt', 3, 'Génétique et hérédité', 'الوراثة'),
('cem_4', NULL, 'svt', 4, 'Immunité', 'المناعة'),

-- BEM 4AM Histoire-Géo
('cem_4', NULL, 'histoire_geo', 1, 'Deuxième Guerre mondiale', 'الحرب العالمية الثانية'),
('cem_4', NULL, 'histoire_geo', 2, 'Décolonisation et Guerre de libération algérienne 1954-1962', 'الاستعمار وحرب التحرير الجزائرية'),
('cem_4', NULL, 'histoire_geo', 3, 'Algérie indépendante', 'الجزائر المستقلة'),
('cem_4', NULL, 'histoire_geo', 4, 'Continent africain', 'القارة الإفريقية'),
('cem_4', NULL, 'histoire_geo', 5, 'Monde arabe', 'الوطن العربي'),

-- BEM 4AM Français
('cem_4', NULL, 'francais', 1, 'Texte argumentatif', 'النص الحجاجي'),
('cem_4', NULL, 'francais', 2, 'Texte explicatif', 'النص التفسيري'),
('cem_4', NULL, 'francais', 3, 'Grammaire : subordination', 'القواعد: التبعية'),
('cem_4', NULL, 'francais', 4, 'Conjugaison : temps composés', 'التصريف: الأزمنة المركبة'),

-- BEM 4AM Arabe
('cem_4', NULL, 'arabe', 1, 'النص الحجاجي', 'النص الحجاجي'),
('cem_4', NULL, 'arabe', 2, 'الظواهر البلاغية', 'الظواهر البلاغية'),
('cem_4', NULL, 'arabe', 3, 'قواعد النحو والصرف', 'قواعد النحو والصرف'),

-- BEM 4AM Anglais
('cem_4', NULL, 'anglais', 1, 'Present perfect and past simple', 'الحاضر التام والماضي البسيط'),
('cem_4', NULL, 'anglais', 2, 'Conditionals', 'الجمل الشرطية'),
('cem_4', NULL, 'anglais', 3, 'Reported speech', 'الكلام المنقول'),

-- 3AS Sciences expérimentales - Mathématiques
('3as', 'sciences_exp', 'mathematiques', 1, 'Suites numériques', 'المتتاليات العددية'),
('3as', 'sciences_exp', 'mathematiques', 2, 'Limites et continuité', 'النهايات والاستمرارية'),
('3as', 'sciences_exp', 'mathematiques', 3, 'Dérivation et étude de fonctions', 'الاشتقاق ودراسة الدوال'),
('3as', 'sciences_exp', 'mathematiques', 4, 'Fonction logarithme népérien', 'الدالة اللوغاريتمية النيبيرية'),
('3as', 'sciences_exp', 'mathematiques', 5, 'Fonctions exponentielles', 'الدوال الأسية'),
('3as', 'sciences_exp', 'mathematiques', 6, 'Primitives et calcul intégral', 'الدوال الأصلية والتكامل'),
('3as', 'sciences_exp', 'mathematiques', 7, 'Nombres complexes', 'الأعداد المركبة'),
('3as', 'sciences_exp', 'mathematiques', 8, 'Géométrie dans l''espace', 'الهندسة في الفضاء'),
('3as', 'sciences_exp', 'mathematiques', 9, 'Probabilités', 'الاحتمالات'),
('3as', 'sciences_exp', 'mathematiques', 10, 'Équations différentielles', 'المعادلات التفاضلية'),

-- 3AS Sciences expérimentales - Physique-Chimie
('3as', 'sciences_exp', 'physique', 1, 'Cinétique chimique - suivi temporel', 'الحركية الكيميائية'),
('3as', 'sciences_exp', 'physique', 2, 'Évolution vers un état d''équilibre', 'التطور نحو حالة توازن'),
('3as', 'sciences_exp', 'physique', 3, 'Acides et bases - pH', 'الأحماض والأسس - pH'),
('3as', 'sciences_exp', 'physique', 4, 'Dipôle RC', 'الثنائي RC'),
('3as', 'sciences_exp', 'physique', 5, 'Dipôle RL', 'الثنائي RL'),
('3as', 'sciences_exp', 'physique', 6, 'Oscillations libres et forcées RLC', 'اهتزازات RLC'),
('3as', 'sciences_exp', 'physique', 7, 'Chute libre et lois de Newton', 'السقوط الحر وقوانين نيوتن'),
('3as', 'sciences_exp', 'physique', 8, 'Physique nucléaire - désintégration', 'الفيزياء النووية والتفكك الإشعاعي'),

-- 3AS Sciences expérimentales - SVT
('3as', 'sciences_exp', 'svt', 1, 'Communication nerveuse et synapse', 'الاتصال العصبي والمشبك'),
('3as', 'sciences_exp', 'svt', 2, 'Communication hormonale', 'الاتصال الهرموني'),
('3as', 'sciences_exp', 'svt', 3, 'Immunologie - réponse immunitaire spécifique', 'المناعة'),
('3as', 'sciences_exp', 'svt', 4, 'Génétique moléculaire et information génétique', 'الوراثة الجزيئية'),
('3as', 'sciences_exp', 'svt', 5, 'Métabolisme cellulaire - photosynthèse et respiration', 'الأيض الخلوي'),
('3as', 'sciences_exp', 'svt', 6, 'Géologie - tectonique des plaques', 'الجيولوجيا وتكتونية الصفائح'),

-- 3AS Mathématiques (filière maths)
('3as', 'maths', 'mathematiques', 1, 'Suites et raisonnement par récurrence', 'المتتاليات والاستدلال بالتراجع'),
('3as', 'maths', 'mathematiques', 2, 'Limites et continuité', 'النهايات والاستمرارية'),
('3as', 'maths', 'mathematiques', 3, 'Dérivabilité et étude de fonctions', 'الاشتقاق ودراسة الدوال'),
('3as', 'maths', 'mathematiques', 4, 'Fonction logarithme népérien', 'اللوغاريتم النيبيري'),
('3as', 'maths', 'mathematiques', 5, 'Fonctions exponentielles', 'الدوال الأسية'),
('3as', 'maths', 'mathematiques', 6, 'Calcul intégral', 'التكامل'),
('3as', 'maths', 'mathematiques', 7, 'Équations différentielles', 'المعادلات التفاضلية'),
('3as', 'maths', 'mathematiques', 8, 'Nombres complexes et applications géométriques', 'الأعداد المركبة والهندسة'),
('3as', 'maths', 'mathematiques', 9, 'Dénombrement et probabilités', 'العد والاحتمالات'),
('3as', 'maths', 'mathematiques', 10, 'Arithmétique - PGCD et congruences', 'الحسابيات - القاسم المشترك الأكبر والموافقات'),
('3as', 'maths', 'mathematiques', 11, 'Géométrie dans l''espace - produit vectoriel', 'الهندسة في الفضاء والجداء الشعاعي'),

-- 3AS Techniques mathématiques
('3as', 'tech_maths', 'mathematiques', 1, 'Suites numériques', 'المتتاليات العددية'),
('3as', 'tech_maths', 'mathematiques', 2, 'Limites, continuité et dérivabilité', 'النهايات والاستمرارية والاشتقاق'),
('3as', 'tech_maths', 'mathematiques', 3, 'Logarithme et exponentielle', 'اللوغاريتم والأس'),
('3as', 'tech_maths', 'mathematiques', 4, 'Calcul intégral', 'التكامل'),
('3as', 'tech_maths', 'mathematiques', 5, 'Nombres complexes', 'الأعداد المركبة'),
('3as', 'tech_maths', 'mathematiques', 6, 'Probabilités', 'الاحتمالات'),
('3as', 'tech_maths', 'genie_meca', 1, 'Cinématique et dynamique', 'الحركية والديناميك'),
('3as', 'tech_maths', 'genie_meca', 2, 'Résistance des matériaux', 'مقاومة المواد'),
('3as', 'tech_maths', 'genie_elec', 1, 'Circuits électriques et électronique', 'الدارات الكهربائية والإلكترونيك'),

-- 3AS Lettres et philosophie
('3as', 'lettres_philo', 'philosophie', 1, 'La conscience et l''inconscient', 'الوعي واللاوعي'),
('3as', 'lettres_philo', 'philosophie', 2, 'La liberté', 'الحرية'),
('3as', 'lettres_philo', 'philosophie', 3, 'La vérité', 'الحقيقة'),
('3as', 'lettres_philo', 'philosophie', 4, 'La science et l''expérience', 'العلم والتجربة'),
('3as', 'lettres_philo', 'philosophie', 5, 'La morale et le devoir', 'الأخلاق والواجب'),
('3as', 'lettres_philo', 'philosophie', 6, 'L''État et la société', 'الدولة والمجتمع'),

-- 3AS Lettres et langues étrangères (spécifique)
('3as', 'lettres_langues', 'anglais', 1, 'Ancient civilizations', 'الحضارات القديمة'),
('3as', 'lettres_langues', 'anglais', 2, 'Ethics in business', 'الأخلاق في الأعمال'),
('3as', 'lettres_langues', 'anglais', 3, 'Education in the world', 'التعليم في العالم'),
('3as', 'lettres_langues', 'anglais', 4, 'Advertising and consumers', 'الإعلان والمستهلك'),

-- 3AS tronc commun - Histoire-Géo
('3as', 'commun', 'histoire_geo', 1, 'Le monde après la 2e guerre mondiale (1945-1989)', 'العالم غداة الحرب العالمية الثانية'),
('3as', 'commun', 'histoire_geo', 2, 'Guerre froide et bipolarisation', 'الحرب الباردة والاستقطاب الثنائي'),
('3as', 'commun', 'histoire_geo', 3, 'Mouvements de libération dans le tiers-monde', 'حركات التحرر في العالم الثالث'),
('3as', 'commun', 'histoire_geo', 4, 'Guerre de libération nationale algérienne 1954-1962', 'الثورة التحريرية الجزائرية 1954-1962'),
('3as', 'commun', 'histoire_geo', 5, 'Algérie de 1962 à nos jours', 'الجزائر منذ 1962 إلى يومنا هذا'),
('3as', 'commun', 'histoire_geo', 6, 'Grandes puissances et espaces géographiques', 'القوى الكبرى والفضاءات الجغرافية الكبرى'),

-- 3AS tronc commun - Français
('3as', 'commun', 'francais', 1, 'Le récit historique', 'النص التاريخي'),
('3as', 'commun', 'francais', 2, 'Le débat d''idées', 'النقاش الفكري'),
('3as', 'commun', 'francais', 3, 'L''appel', 'النداء'),
('3as', 'commun', 'francais', 4, 'La nouvelle fantastique', 'القصة العجائبية'),

-- 3AS tronc commun - Arabe
('3as', 'commun', 'arabe', 1, 'الأدب في عصر النهضة', 'الأدب في عصر النهضة'),
('3as', 'commun', 'arabe', 2, 'الأدب الجزائري الحديث', 'الأدب الجزائري الحديث'),
('3as', 'commun', 'arabe', 3, 'الشعر الحر', 'الشعر الحر'),
('3as', 'commun', 'arabe', 4, 'البلاغة والنقد الأدبي', 'البلاغة والنقد الأدبي'),

-- 3AS tronc commun - Anglais
('3as', 'commun', 'anglais', 1, 'Ancient civilizations', 'الحضارات القديمة'),
('3as', 'commun', 'anglais', 2, 'Ethics in business', 'الأخلاق في الأعمال'),
('3as', 'commun', 'anglais', 3, 'Education in the world', 'التعليم في العالم'),
('3as', 'commun', 'anglais', 4, 'Advertising and consumers', 'الإعلان والمستهلك'),

-- 3AS Gestion-Économie
('3as', 'gestion_economie', 'economie', 1, 'Marché et prix', 'السوق والأسعار'),
('3as', 'gestion_economie', 'economie', 2, 'Comptabilité générale', 'المحاسبة العامة'),
('3as', 'gestion_economie', 'economie', 3, 'Analyse financière', 'التحليل المالي'),
('3as', 'gestion_economie', 'economie', 4, 'Fiscalité algérienne', 'الجباية الجزائرية'),
('3as', 'gestion_economie', 'droit', 1, 'Droit commercial algérien', 'القانون التجاري الجزائري'),
('3as', 'gestion_economie', 'droit', 2, 'Droit du travail', 'قانون العمل');