-- RLS: events

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ev_del ON public.events FOR DELETE USING ((user_id = public.app_current_user()));
CREATE POLICY ev_ins ON public.events FOR INSERT WITH CHECK ((user_id = public.app_current_user()));
CREATE POLICY ev_sel ON public.events FOR SELECT USING ((user_id = public.app_current_user()));
CREATE POLICY ev_upd ON public.events FOR UPDATE USING ((user_id = public.app_current_user())) WITH CHECK ((user_id = public.app_current_user()));
CREATE POLICY p_events_select ON public.events FOR SELECT USING ((user_id = public.app_current_user()));
