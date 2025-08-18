-- RLS: custom_assets

ALTER TABLE public.custom_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY ca_del ON public.custom_assets FOR DELETE USING ((user_id = public.app_current_user()));
CREATE POLICY ca_ins ON public.custom_assets FOR INSERT WITH CHECK ((user_id = public.app_current_user()));
CREATE POLICY ca_sel ON public.custom_assets FOR SELECT USING ((user_id = public.app_current_user()));
CREATE POLICY ca_upd ON public.custom_assets FOR UPDATE USING ((user_id = public.app_current_user())) WITH CHECK ((user_id = public.app_current_user()));
