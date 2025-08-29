-- RLS: user_profiles

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY prof_self_insert ON public.user_profiles FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY prof_self_select ON public.user_profiles FOR SELECT USING ((user_id = auth.uid()));
CREATE POLICY prof_self_update ON public.user_profiles FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY up_del ON public.user_profiles FOR DELETE USING ((user_id = public.app_current_user()));
CREATE POLICY up_ins ON public.user_profiles FOR INSERT WITH CHECK ((user_id = public.app_current_user()));
CREATE POLICY up_sel ON public.user_profiles FOR SELECT USING ((user_id = public.app_current_user()));
CREATE POLICY up_upd ON public.user_profiles FOR UPDATE USING ((user_id = public.app_current_user())) WITH CHECK ((user_id = public.app_current_user()));
