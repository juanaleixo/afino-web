create table public.waitlist (
  id uuid not null default gen_random_uuid (),
  email text not null,
  name text null,
  source text null default 'preview'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint waitlist_pkey primary key (id),
  constraint waitlist_email_key unique (email)
) TABLESPACE pg_default;

create index IF not exists idx_waitlist_email on public.waitlist using btree (email) TABLESPACE pg_default;

create index IF not exists idx_waitlist_created_at on public.waitlist using btree (created_at) TABLESPACE pg_default;

create trigger update_waitlist_updated_at BEFORE
update on waitlist for EACH row
execute FUNCTION update_waitlist_updated_at ();