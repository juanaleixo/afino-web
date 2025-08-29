-- RLS: external_items

ALTER TABLE public.external_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY ei_del ON public.external_items FOR DELETE USING ((user_id = public.app_current_user()));
CREATE POLICY ei_ins ON public.external_items FOR INSERT WITH CHECK ((user_id = public.app_current_user()));
CREATE POLICY ei_sel ON public.external_items FOR SELECT USING ((user_id = public.app_current_user()));
CREATE POLICY ei_upd ON public.external_items FOR UPDATE USING ((user_id = public.app_current_user())) WITH CHECK ((user_id = public.app_current_user()));
