-- Voice receptionist upgrades: busy mode, message relay, call-booked events.

alter table public.user_settings
  add column if not exists busy_mode boolean not null default false;

alter table public.call_summaries
  add column if not exists message_for_user text,
  add column if not exists booked_event_id uuid;
