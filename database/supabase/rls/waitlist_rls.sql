-- RLS: waitlist

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert" ON public.waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated read" ON public.waitlist FOR SELECT USING (auth.role() = 'authenticated');
