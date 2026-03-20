-- Add columns for full 13-question application flow
alter table public.whatsapp_applications
  add column if not exists english_level text,
  add column if not exists internet_speed text,
  add column if not exists phone_hq_video text,
  add column if not exists comfortable_on_cam text,
  add column if not exists alone_place text,
  add column if not exists social_handle text,
  add column if not exists best_video_url text;
