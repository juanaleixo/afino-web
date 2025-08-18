-- RLS: daily_positions_acct

ALTER TABLE public.daily_positions_acct ENABLE ROW LEVEL SECURITY;

CREATE POLICY dpa_sel ON public.daily_positions_acct FOR SELECT USING ((user_id = public.app_current_user()));
