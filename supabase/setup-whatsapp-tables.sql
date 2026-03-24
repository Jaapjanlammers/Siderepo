-- Run this in Supabase Dashboard → SQL Editor → New query
-- Creates whatsapp_sessions (whatsapp_applications already exists in your project)

create table if not exists public.whatsapp_sessions (
  wa_id text primary key,
  stage text not null default 'idle',
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint whatsapp_sessions_stage_check
    check (stage in (
      'idle',
      'choose_vacancy',
      'choose_action',
      'ask_first_name',
      'ask_last_name',
      'ask_email',
      'ask_hours_per_week',
      'ask_age',
      'ask_birthday',
      'ask_gender',
      'ask_country',
      'ask_english_level',
      'ask_internet_speed',
      'ask_phone_hq_video',
      'ask_comfortable_on_cam',
      'ask_alone_place',
      'ask_social_handle',
      'ask_best_video_url',
      'ask_over18',
      'done'
    ))
);

create table if not exists public.whatsapp_inbox (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null,
  message_text text not null,
  stage text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
