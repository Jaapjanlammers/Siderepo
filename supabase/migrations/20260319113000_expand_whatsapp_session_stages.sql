alter table public.whatsapp_sessions
  drop constraint if exists whatsapp_sessions_stage_check;

alter table public.whatsapp_sessions
  add constraint whatsapp_sessions_stage_check
  check (
    stage in (
      'idle',
      'choose_vacancy',
      'choose_action',
      'ask_first_name',
      'ask_last_name',
      'ask_email',
      'ask_hours_per_week',
      'ask_age',
      'ask_country',
      'ask_english_level',
      'ask_internet_speed',
      'ask_phone_hq_video',
      'ask_comfortable_on_cam',
      'ask_alone_place',
      'ask_social_handle',
      'ask_best_video_url',
      'done'
    )
  );

