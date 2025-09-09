-- RLS: custom_asset_valuations

ALTER TABLE public.custom_asset_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY cav_del ON public.custom_asset_valuations FOR DELETE USING ((EXISTS ( SELECT 1
FROM public.custom_assets a
WHERE ((a.id = custom_asset_valuations.asset_id) AND (a.user_id = public.app_current_user())))));
CREATE POLICY cav_ins ON public.custom_asset_valuations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
FROM public.custom_assets a
WHERE ((a.id = custom_asset_valuations.asset_id) AND (a.user_id = public.app_current_user())))));
CREATE POLICY cav_sel ON public.custom_asset_valuations FOR SELECT USING ((EXISTS ( SELECT 1
FROM public.custom_assets a
WHERE ((a.id = custom_asset_valuations.asset_id) AND (a.user_id = public.app_current_user())))));
CREATE POLICY cav_upd ON public.custom_asset_valuations FOR UPDATE USING ((EXISTS ( SELECT 1
FROM public.custom_assets a
WHERE ((a.id = custom_asset_valuations.asset_id) AND (a.user_id = public.app_current_user()))))) WITH CHECK ((EXISTS ( SELECT 1
FROM public.custom_assets a
WHERE ((a.id = custom_asset_valuations.asset_id) AND (a.user_id = public.app_current_user())))));
