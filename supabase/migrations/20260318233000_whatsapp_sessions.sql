create table if not exists public.whatsapp_sessions (
  wa_id text primary key,
  stage text not null default 'idle',
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint whatsapp_sessions_stage_check
    check (stage in ('idle', 'choose_vacancy', 'choose_action', 'ask_name', 'ask_age', 'ask_country', 'done'))
);

