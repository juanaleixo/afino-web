-- RLS: daily_positions_acct

ALTER TABLE public.daily_positions_acct ENABLE ROW LEVEL SECURITY;

-- Leitura: apenas do próprio usuário
DO $$ BEGIN
  CREATE POLICY dpa_sel ON public.daily_positions_acct
    FOR SELECT USING (user_id = public.app_current_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Escrita: permitir que processos no contexto do usuário gravem linhas do próprio usuário
-- Isto permite que a função SECURITY DEFINER insira/atualize/exclua enquanto mantém o vínculo ao usuário
DO $$ BEGIN
  CREATE POLICY dpa_ins ON public.daily_positions_acct
    FOR INSERT WITH CHECK (user_id = public.app_current_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY dpa_upd ON public.daily_positions_acct
    FOR UPDATE USING (user_id = public.app_current_user())
             WITH CHECK (user_id = public.app_current_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY dpa_del ON public.daily_positions_acct
    FOR DELETE USING (user_id = public.app_current_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
