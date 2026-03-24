create table if not exists public.whatsapp_inbox (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null,
  message_text text not null,
  stage text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_inbox_created_at_idx
  on public.whatsapp_inbox (created_at desc);

create index if not exists whatsapp_inbox_resolved_idx
  on public.whatsapp_inbox (resolved, created_at desc);
