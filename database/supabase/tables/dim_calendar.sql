-- Table: dim_calendar
-- Description: Dimension table for calendar dates.

CREATE TABLE public.dim_calendar (
    date date NOT NULL
);

ALTER TABLE public.dim_calendar OWNER TO postgres;

ALTER TABLE ONLY public.dim_calendar
ADD CONSTRAINT dim_calendar_pkey PRIMARY KEY (date);
