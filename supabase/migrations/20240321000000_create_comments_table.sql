create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  comment text not null,
  commented_by text
);

-- Enable RLS
alter table public.comments enable row level security;

-- Create policies
create policy "Enable read access for all users" on public.comments
  for select using (true);

create policy "Enable insert access for all users" on public.comments
  for insert with check (true);

-- Set up realtime
alter publication supabase_realtime add table comments; 