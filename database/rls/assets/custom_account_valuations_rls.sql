-- RLS: custom_account_valuations

ALTER TABLE public.custom_account_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY cav_acct_del ON public.custom_account_valuations FOR DELETE USING ((EXISTS ( SELECT 1
FROM public.accounts a
WHERE ((a.id = custom_account_valuations.account_id) AND (a.user_id = public.app_current_user())))));
CREATE POLICY cav_acct_ins ON public.custom_account_valuations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
FROM public.accounts a
WHERE ((a.id = custom_account_valuations.account_id) AND (a.user_id = public.app_current_user())))));
CREATE POLICY cav_acct_sel ON public.custom_account_valuations FOR SELECT USING ((EXISTS ( SELECT 1
FROM public.accounts a
WHERE ((a.id = custom_account_valuations.account_id) AND (a.user_id = public.app_current_user())))));
CREATE POLICY cav_acct_upd ON public.custom_account_valuations FOR UPDATE USING ((EXISTS ( SELECT 1
FROM public.accounts a
WHERE ((a.id = custom_account_valuations.account_id) AND (a.user_id = public.app_current_user()))))) WITH CHECK ((EXISTS ( SELECT 1
FROM public.accounts a
WHERE ((a.id = custom_account_valuations.account_id) AND (a.user_id = public.app_current_user())))));
CREATE POLICY p_cav_select ON public.custom_account_valuations FOR SELECT USING ((EXISTS ( SELECT 1
FROM public.accounts a
WHERE ((a.id = custom_account_valuations.account_id) AND (a.user_id = public.app_current_user())))));
