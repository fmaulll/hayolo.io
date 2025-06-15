create table public.crosswords (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  entries jsonb not null,
  grid jsonb not null,
  placed_words jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.crosswords enable row level security;

-- Create a policy that allows all users to read crosswords
create policy "Crosswords are viewable by everyone" on public.crosswords
  for select using (true);

-- Create a policy that allows authenticated users to insert crosswords
create policy "Users can create crosswords" on public.crosswords
  for insert with check (true);

-- Create indexes
create index crosswords_created_at_idx on public.crosswords (created_at desc); 