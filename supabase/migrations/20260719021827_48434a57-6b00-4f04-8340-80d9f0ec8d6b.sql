-- B3: revoke UPDATE on sensitive student_profiles columns
REVOKE UPDATE ON public.student_profiles FROM authenticated;
GRANT UPDATE (school_level, exam_target, preferred_language) ON public.student_profiles TO authenticated;

-- Also lock INSERT to prevent forging credits/streak on initial insert
REVOKE INSERT ON public.student_profiles FROM authenticated;
GRANT INSERT (user_id, school_level, exam_target, preferred_language) ON public.student_profiles TO authenticated;