alter table public.whatsapp_sessions
  drop constraint if exists whatsapp_sessions_stage_check;

alter table public.whatsapp_sessions
  add constraint whatsapp_sessions_stage_check
  check (stage in ('idle', 'choose_vacancy', 'choose_action', 'ask_name', 'ask_age', 'ask_country', 'done'));

