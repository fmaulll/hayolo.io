-- Create crossword_sessions table
create table public.crossword_sessions (
  id uuid default gen_random_uuid() primary key,
  crossword_id uuid references public.crosswords(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'in_progress', 'completed')),
  start_time timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create player_sessions table for anonymous players
create table public.player_sessions (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.crossword_sessions(id) on delete cascade,
  nickname text not null,
  is_host boolean default false,
  joined_at timestamp with time zone default now(),
  last_active timestamp with time zone default now()
);

-- Add RLS policies
alter table public.crossword_sessions enable row level security;
alter table public.player_sessions enable row level security;

-- Policies for crossword_sessions
create policy "Anyone can view crossword sessions"
  on public.crossword_sessions for select
  using (true);

create policy "Authenticated users can create sessions"
  on public.crossword_sessions for insert
  with check (auth.role() = 'authenticated');

create policy "Session owners can update their sessions"
  on public.crossword_sessions for update using (
    exists (
      select 1 from public.crosswords c
      where c.id = crossword_id
      and c.user_id = auth.uid()
    )
  );

-- Policies for player_sessions
create policy "Anyone can view player sessions"
  on public.player_sessions for select
  using (true);

create policy "Anyone can create player sessions"
  on public.player_sessions for insert
  with check (true);

create policy "Players can update their own session"
  on public.player_sessions for update
  using (true);

-- Function to join a session
create or replace function public.join_crossword_session(
  p_crossword_id uuid,
  p_nickname text,
  p_is_host boolean default false
) returns uuid language plpgsql security definer as $$
declare
  v_session_id uuid;
begin
  -- Get or create a waiting session
  select id into v_session_id
  from public.crossword_sessions
  where crossword_id = p_crossword_id 
    and status = 'waiting'
  order by created_at desc
  limit 1;

  -- If no waiting session exists, create new one
  if v_session_id is null then
    insert into public.crossword_sessions (crossword_id)
    values (p_crossword_id)
    returning id into v_session_id;
  end if;

  -- Join the session
  insert into public.player_sessions (session_id, nickname, is_host)
  values (v_session_id, p_nickname, p_is_host);

  return v_session_id;
end;
$$; 