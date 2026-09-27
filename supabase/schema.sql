-- One row per account holding the whole progress snapshot as JSON.
create table if not exists public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "own progress: read" on public.progress
  for select using (auth.uid() = user_id);
create policy "own progress: insert" on public.progress
  for insert with check (auth.uid() = user_id);
create policy "own progress: update" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
