
-- Education cycles/levels/subjects/chapters for the course library

CREATE TABLE public.edu_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle text NOT NULL CHECK (cycle IN ('primaire','cem','lycee')),
  grade text NOT NULL,
  track text,
  label_fr text NOT NULL,
  label_ar text NOT NULL,
  slug text NOT NULL UNIQUE,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.edu_levels TO anon, authenticated;
GRANT ALL ON public.edu_levels TO service_role;
ALTER TABLE public.edu_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read edu_levels" ON public.edu_levels FOR SELECT USING (true);
CREATE POLICY "Admins manage edu_levels" ON public.edu_levels FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.edu_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL REFERENCES public.edu_levels(id) ON DELETE CASCADE,
  name_fr text NOT NULL,
  name_ar text NOT NULL,
  slug text NOT NULL,
  icon text,
  color text,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (level_id, slug)
);
GRANT SELECT ON public.edu_subjects TO anon, authenticated;
GRANT ALL ON public.edu_subjects TO service_role;
ALTER TABLE public.edu_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read edu_subjects" ON public.edu_subjects FOR SELECT USING (true);
CREATE POLICY "Admins manage edu_subjects" ON public.edu_subjects FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.edu_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.edu_subjects(id) ON DELETE CASCADE,
  title_fr text NOT NULL,
  title_ar text NOT NULL,
  summary_fr text,
  summary_ar text,
  order_index int NOT NULL DEFAULT 0,
  ai_content jsonb,
  ai_generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.edu_chapters TO anon, authenticated;
GRANT ALL ON public.edu_chapters TO service_role;
ALTER TABLE public.edu_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read edu_chapters" ON public.edu_chapters FOR SELECT USING (true);
CREATE POLICY "Admins manage edu_chapters" ON public.edu_chapters FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_edu_levels_updated BEFORE UPDATE ON public.edu_levels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_edu_subjects_updated BEFORE UPDATE ON public.edu_subjects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_edu_chapters_updated BEFORE UPDATE ON public.edu_chapters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_edu_levels_cycle ON public.edu_levels(cycle, order_index);
CREATE INDEX idx_edu_subjects_level ON public.edu_subjects(level_id, order_index);
CREATE INDEX idx_edu_chapters_subject ON public.edu_chapters(subject_id, order_index);

-- Seed: Levels
INSERT INTO public.edu_levels (cycle, grade, track, label_fr, label_ar, slug, order_index) VALUES
  ('primaire','1',NULL,'1ère année primaire','السنة الأولى ابتدائي','primaire-1',1),
  ('primaire','2',NULL,'2ème année primaire','السنة الثانية ابتدائي','primaire-2',2),
  ('primaire','3',NULL,'3ème année primaire','السنة الثالثة ابتدائي','primaire-3',3),
  ('primaire','4',NULL,'4ème année primaire','السنة الرابعة ابتدائي','primaire-4',4),
  ('primaire','5',NULL,'5ème année primaire','السنة الخامسة ابتدائي','primaire-5',5),
  ('cem','1',NULL,'1ère année moyenne','السنة الأولى متوسط','cem-1',1),
  ('cem','2',NULL,'2ème année moyenne','السنة الثانية متوسط','cem-2',2),
  ('cem','3',NULL,'3ème année moyenne','السنة الثالثة متوسط','cem-3',3),
  ('cem','4',NULL,'4ème année moyenne (BEM)','السنة الرابعة متوسط (شهادة التعليم المتوسط)','cem-4',4),
  ('lycee','1AS','tronc-commun','1ère année secondaire — Tronc commun','السنة الأولى ثانوي — جذع مشترك','lycee-1as',1),
  ('lycee','2AS','sciences','2ème année — Sciences expérimentales','السنة الثانية — علوم تجريبية','lycee-2as-sciences',2),
  ('lycee','2AS','maths','2ème année — Mathématiques','السنة الثانية — رياضيات','lycee-2as-maths',3),
  ('lycee','2AS','tech-maths','2ème année — Technique-Maths','السنة الثانية — تقني رياضي','lycee-2as-tech',4),
  ('lycee','2AS','gestion','2ème année — Gestion & Économie','السنة الثانية — تسيير واقتصاد','lycee-2as-gestion',5),
  ('lycee','2AS','lettres','2ème année — Lettres & Philosophie','السنة الثانية — آداب وفلسفة','lycee-2as-lettres',6),
  ('lycee','2AS','langues','2ème année — Langues étrangères','السنة الثانية — لغات أجنبية','lycee-2as-langues',7),
  ('lycee','3AS','sciences','Terminale — Sciences expérimentales (BAC)','السنة الثالثة — علوم تجريبية (باكالوريا)','lycee-3as-sciences',8),
  ('lycee','3AS','maths','Terminale — Mathématiques (BAC)','السنة الثالثة — رياضيات (باكالوريا)','lycee-3as-maths',9),
  ('lycee','3AS','tech-maths','Terminale — Technique-Maths (BAC)','السنة الثالثة — تقني رياضي (باكالوريا)','lycee-3as-tech',10),
  ('lycee','3AS','gestion','Terminale — Gestion & Économie (BAC)','السنة الثالثة — تسيير واقتصاد (باكالوريا)','lycee-3as-gestion',11),
  ('lycee','3AS','lettres','Terminale — Lettres & Philosophie (BAC)','السنة الثالثة — آداب وفلسفة (باكالوريا)','lycee-3as-lettres',12),
  ('lycee','3AS','langues','Terminale — Langues étrangères (BAC)','السنة الثالثة — لغات أجنبية (باكالوريا)','lycee-3as-langues',13);

-- Seed: Common subjects per level (minimal; admin will refine)
-- Primaire
INSERT INTO public.edu_subjects (level_id, name_fr, name_ar, slug, icon, color, order_index)
SELECT id, s.name_fr, s.name_ar, s.slug, s.icon, s.color, s.ord
FROM public.edu_levels l
CROSS JOIN (VALUES
  ('Arabe','اللغة العربية','arabe','📖','#10B981',1),
  ('Français','اللغة الفرنسية','francais','🇫🇷','#3B82F6',2),
  ('Mathématiques','الرياضيات','maths','🧮','#F59E0B',3),
  ('Éveil scientifique','التربية العلمية','sciences','🔬','#8B5CF6',4),
  ('Éducation islamique','التربية الإسلامية','islamique','🕌','#059669',5)
) AS s(name_fr, name_ar, slug, icon, color, ord)
WHERE l.cycle = 'primaire';

-- CEM
INSERT INTO public.edu_subjects (level_id, name_fr, name_ar, slug, icon, color, order_index)
SELECT id, s.name_fr, s.name_ar, s.slug, s.icon, s.color, s.ord
FROM public.edu_levels l
CROSS JOIN (VALUES
  ('Arabe','اللغة العربية','arabe','📖','#10B981',1),
  ('Français','اللغة الفرنسية','francais','🇫🇷','#3B82F6',2),
  ('Anglais','اللغة الإنجليزية','anglais','🇬🇧','#6366F1',3),
  ('Mathématiques','الرياضيات','maths','🧮','#F59E0B',4),
  ('Physique','العلوم الفيزيائية','physique','⚛️','#EF4444',5),
  ('SVT','علوم الطبيعة والحياة','svt','🌿','#22C55E',6),
  ('Histoire-Géo','التاريخ والجغرافيا','histgeo','🗺️','#0EA5E9',7),
  ('Éducation islamique','التربية الإسلامية','islamique','🕌','#059669',8),
  ('Éducation civique','التربية المدنية','civique','⚖️','#94A3B8',9),
  ('Informatique','الإعلام الآلي','info','💻','#A855F7',10)
) AS s(name_fr, name_ar, slug, icon, color, ord)
WHERE l.cycle = 'cem';

-- Lycée tronc commun
INSERT INTO public.edu_subjects (level_id, name_fr, name_ar, slug, icon, color, order_index)
SELECT id, s.name_fr, s.name_ar, s.slug, s.icon, s.color, s.ord
FROM public.edu_levels l
CROSS JOIN (VALUES
  ('Arabe','اللغة العربية','arabe','📖','#10B981',1),
  ('Français','اللغة الفرنسية','francais','🇫🇷','#3B82F6',2),
  ('Anglais','اللغة الإنجليزية','anglais','🇬🇧','#6366F1',3),
  ('Mathématiques','الرياضيات','maths','🧮','#F59E0B',4),
  ('Physique','العلوم الفيزيائية','physique','⚛️','#EF4444',5),
  ('SVT','علوم الطبيعة والحياة','svt','🌿','#22C55E',6),
  ('Histoire-Géo','التاريخ والجغرافيا','histgeo','🗺️','#0EA5E9',7),
  ('Éducation islamique','التربية الإسلامية','islamique','🕌','#059669',8),
  ('Philosophie','الفلسفة','philo','🧠','#EC4899',9)
) AS s(name_fr, name_ar, slug, icon, color, ord)
WHERE l.cycle = 'lycee' AND l.grade = '1AS';

-- Lycée Sciences (2AS/3AS)
INSERT INTO public.edu_subjects (level_id, name_fr, name_ar, slug, icon, color, order_index)
SELECT id, s.name_fr, s.name_ar, s.slug, s.icon, s.color, s.ord
FROM public.edu_levels l
CROSS JOIN (VALUES
  ('Mathématiques','الرياضيات','maths','🧮','#F59E0B',1),
  ('Physique','العلوم الفيزيائية','physique','⚛️','#EF4444',2),
  ('SVT','علوم الطبيعة والحياة','svt','🌿','#22C55E',3),
  ('Arabe','اللغة العربية','arabe','📖','#10B981',4),
  ('Français','اللغة الفرنسية','francais','🇫🇷','#3B82F6',5),
  ('Anglais','اللغة الإنجليزية','anglais','🇬🇧','#6366F1',6),
  ('Philosophie','الفلسفة','philo','🧠','#EC4899',7),
  ('Histoire-Géo','التاريخ والجغرافيا','histgeo','🗺️','#0EA5E9',8),
  ('Éducation islamique','التربية الإسلامية','islamique','🕌','#059669',9)
) AS s(name_fr, name_ar, slug, icon, color, ord)
WHERE l.cycle = 'lycee' AND l.track = 'sciences';

-- Lycée Maths (2AS/3AS)
INSERT INTO public.edu_subjects (level_id, name_fr, name_ar, slug, icon, color, order_index)
SELECT id, s.name_fr, s.name_ar, s.slug, s.icon, s.color, s.ord
FROM public.edu_levels l
CROSS JOIN (VALUES
  ('Mathématiques','الرياضيات','maths','🧮','#F59E0B',1),
  ('Physique','العلوم الفيزيائية','physique','⚛️','#EF4444',2),
  ('SVT','علوم الطبيعة والحياة','svt','🌿','#22C55E',3),
  ('Arabe','اللغة العربية','arabe','📖','#10B981',4),
  ('Français','اللغة الفرنسية','francais','🇫🇷','#3B82F6',5),
  ('Anglais','اللغة الإنجليزية','anglais','🇬🇧','#6366F1',6),
  ('Philosophie','الفلسفة','philo','🧠','#EC4899',7),
  ('Histoire-Géo','التاريخ والجغرافيا','histgeo','🗺️','#0EA5E9',8),
  ('Éducation islamique','التربية الإسلامية','islamique','🕌','#059669',9)
) AS s(name_fr, name_ar, slug, icon, color, ord)
WHERE l.cycle = 'lycee' AND l.track = 'maths';

-- Lycée Tech-Maths (2AS/3AS)
INSERT INTO public.edu_subjects (level_id, name_fr, name_ar, slug, icon, color, order_index)
SELECT id, s.name_fr, s.name_ar, s.slug, s.icon, s.color, s.ord
FROM public.edu_levels l
CROSS JOIN (VALUES
  ('Mathématiques','الرياضيات','maths','🧮','#F59E0B',1),
  ('Physique','العلوم الفيزيائية','physique','⚛️','#EF4444',2),
  ('Technologie','التكنولوجيا','techno','⚙️','#64748B',3),
  ('Arabe','اللغة العربية','arabe','📖','#10B981',4),
  ('Français','اللغة الفرنسية','francais','🇫🇷','#3B82F6',5),
  ('Anglais','اللغة الإنجليزية','anglais','🇬🇧','#6366F1',6),
  ('Philosophie','الفلسفة','philo','🧠','#EC4899',7)
) AS s(name_fr, name_ar, slug, icon, color, ord)
WHERE l.cycle = 'lycee' AND l.track = 'tech-maths';

-- Lycée Gestion (2AS/3AS)
INSERT INTO public.edu_subjects (level_id, name_fr, name_ar, slug, icon, color, order_index)
SELECT id, s.name_fr, s.name_ar, s.slug, s.icon, s.color, s.ord
FROM public.edu_levels l
CROSS JOIN (VALUES
  ('Mathématiques','الرياضيات','maths','🧮','#F59E0B',1),
  ('Économie','الاقتصاد','eco','💹','#0EA5E9',2),
  ('Comptabilité','المحاسبة','compta','🧾','#14B8A6',3),
  ('Droit','القانون','droit','⚖️','#94A3B8',4),
  ('Arabe','اللغة العربية','arabe','📖','#10B981',5),
  ('Français','اللغة الفرنسية','francais','🇫🇷','#3B82F6',6),
  ('Anglais','اللغة الإنجليزية','anglais','🇬🇧','#6366F1',7),
  ('Histoire-Géo','التاريخ والجغرافيا','histgeo','🗺️','#0EA5E9',8),
  ('Philosophie','الفلسفة','philo','🧠','#EC4899',9)
) AS s(name_fr, name_ar, slug, icon, color, ord)
WHERE l.cycle = 'lycee' AND l.track = 'gestion';

-- Lycée Lettres (2AS/3AS)
INSERT INTO public.edu_subjects (level_id, name_fr, name_ar, slug, icon, color, order_index)
SELECT id, s.name_fr, s.name_ar, s.slug, s.icon, s.color, s.ord
FROM public.edu_levels l
CROSS JOIN (VALUES
  ('Arabe','اللغة العربية','arabe','📖','#10B981',1),
  ('Philosophie','الفلسفة','philo','🧠','#EC4899',2),
  ('Histoire-Géo','التاريخ والجغرافيا','histgeo','🗺️','#0EA5E9',3),
  ('Français','اللغة الفرنسية','francais','🇫🇷','#3B82F6',4),
  ('Anglais','اللغة الإنجليزية','anglais','🇬🇧','#6366F1',5),
  ('Éducation islamique','التربية الإسلامية','islamique','🕌','#059669',6),
  ('Mathématiques','الرياضيات','maths','🧮','#F59E0B',7)
) AS s(name_fr, name_ar, slug, icon, color, ord)
WHERE l.cycle = 'lycee' AND l.track = 'lettres';

-- Lycée Langues (2AS/3AS)
INSERT INTO public.edu_subjects (level_id, name_fr, name_ar, slug, icon, color, order_index)
SELECT id, s.name_fr, s.name_ar, s.slug, s.icon, s.color, s.ord
FROM public.edu_levels l
CROSS JOIN (VALUES
  ('Arabe','اللغة العربية','arabe','📖','#10B981',1),
  ('Français','اللغة الفرنسية','francais','🇫🇷','#3B82F6',2),
  ('Anglais','اللغة الإنجليزية','anglais','🇬🇧','#6366F1',3),
  ('Espagnol / Allemand','الإسبانية / الألمانية','langue3','🌍','#F97316',4),
  ('Philosophie','الفلسفة','philo','🧠','#EC4899',5),
  ('Histoire-Géo','التاريخ والجغرافيا','histgeo','🗺️','#0EA5E9',6),
  ('Éducation islamique','التربية الإسلامية','islamique','🕌','#059669',7)
) AS s(name_fr, name_ar, slug, icon, color, ord)
WHERE l.cycle = 'lycee' AND l.track = 'langues';
