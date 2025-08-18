-- RLS: accounts

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY acc_del ON public.accounts FOR DELETE USING ((user_id = public.app_current_user()));
CREATE POLICY acc_ins ON public.accounts FOR INSERT WITH CHECK ((user_id = public.app_current_user()));
CREATE POLICY acc_sel ON public.accounts FOR SELECT USING ((user_id = public.app_current_user()));
CREATE POLICY acc_upd ON public.accounts FOR UPDATE USING ((user_id = public.app_current_user())) WITH CHECK ((user_id = public.app_current_user()));
