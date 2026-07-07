-- Envoy AI Secretary — initial schema
-- Apply to a dedicated Supabase project (separate from other apps).

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users (id),
  phone_number text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.users (id) on delete cascade,
  autonomy text not null default 'suggest' check (autonomy in ('suggest', 'auto_review', 'full_auto')),
  full_auto_contacts text[] not null default '{}',
  voice_enabled boolean not null default false,
  persona_id uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key,
  user_id uuid not null,
  from_number text not null,
  contact_name text,
  body text not null,
  received_at timestamptz not null,
  channel text not null default 'sms' check (channel in ('sms', 'virtual')),
  created_at timestamptz not null default now()
);

create table if not exists public.draft_replies (
  id uuid primary key,
  message_id uuid not null references public.messages (id) on delete cascade,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'sent', 'dismissed', 'edited')),
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key,
  user_id uuid not null,
  source_message_id uuid,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  attendees text[] not null default '{}',
  notes text,
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.style_profiles (
  user_id uuid primary key,
  tone_summary text not null,
  greetings text[] not null default '{}',
  signoffs text[] not null default '{}',
  emoji_frequency text not null default 'rare' check (emoji_frequency in ('none', 'rare', 'frequent')),
  avg_length text not null default 'short' check (avg_length in ('short', 'medium', 'long')),
  exemplars jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table if not exists public.personas (
  id uuid primary key,
  user_id uuid not null,
  name text not null,
  voice text not null default 'alloy',
  greeting text not null,
  instructions text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.call_summaries (
  id uuid primary key,
  user_id uuid not null,
  caller_number text not null,
  caller_name text,
  reason text,
  urgency text not null default 'medium' check (urgency in ('low', 'medium', 'high')),
  callback_requested boolean not null default false,
  transcript text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_user_received_idx on public.messages (user_id, received_at desc);
create index if not exists events_user_starts_idx on public.calendar_events (user_id, starts_at);
create index if not exists calls_user_created_idx on public.call_summaries (user_id, created_at desc);

alter table public.messages enable row level security;
alter table public.draft_replies enable row level security;
alter table public.calendar_events enable row level security;
alter table public.style_profiles enable row level security;
alter table public.personas enable row level security;
alter table public.call_summaries enable row level security;
alter table public.user_settings enable row level security;
-- Service-role key bypasses RLS; add per-user policies when client-side access is introduced.
