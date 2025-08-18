-- RLS: plans

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.plans FOR SELECT USING (true);
