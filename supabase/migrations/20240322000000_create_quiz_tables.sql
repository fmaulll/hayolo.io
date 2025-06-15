-- Create quizzes table
create table if not exists public.quizzes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  title text not null,
  description text,
  user_id uuid references auth.users(id) on delete cascade not null,
  is_published boolean default false,
  time_limit integer, -- in minutes, null means no time limit
  total_points integer default 0
);

-- Create questions table
create table if not exists public.quiz_questions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  quiz_id uuid references public.quizzes(id) on delete cascade not null,
  question_text text not null,
  question_type text not null check (question_type in ('multiple_choice', 'yes_no', 'short_answer')),
  points integer default 1,
  order_index integer not null,
  image_url text,
  correct_answer text not null -- For yes/no and short answer questions
);

-- Create multiple choice options table
create table if not exists public.quiz_question_options (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  question_id uuid references public.quiz_questions(id) on delete cascade not null,
  option_text text not null,
  is_correct boolean default false,
  order_index integer not null
);

-- Enable RLS
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_question_options enable row level security;

-- Create policies for quizzes
create policy "Users can view their own quizzes"
  on public.quizzes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own quizzes"
  on public.quizzes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own quizzes"
  on public.quizzes for update
  using (auth.uid() = user_id);

create policy "Users can delete their own quizzes"
  on public.quizzes for delete
  using (auth.uid() = user_id);

-- Create policies for quiz questions
create policy "Users can view questions of their quizzes"
  on public.quiz_questions for select
  using (
    exists (
      select 1 from public.quizzes
      where quizzes.id = quiz_questions.quiz_id
      and quizzes.user_id = auth.uid()
    )
  );

create policy "Users can insert questions to their quizzes"
  on public.quiz_questions for insert
  with check (
    exists (
      select 1 from public.quizzes
      where quizzes.id = quiz_questions.quiz_id
      and quizzes.user_id = auth.uid()
    )
  );

create policy "Users can update questions of their quizzes"
  on public.quiz_questions for update
  using (
    exists (
      select 1 from public.quizzes
      where quizzes.id = quiz_questions.quiz_id
      and quizzes.user_id = auth.uid()
    )
  );

create policy "Users can delete questions of their quizzes"
  on public.quiz_questions for delete
  using (
    exists (
      select 1 from public.quizzes
      where quizzes.id = quiz_questions.quiz_id
      and quizzes.user_id = auth.uid()
    )
  );

-- Create policies for quiz question options
create policy "Users can view options of their quiz questions"
  on public.quiz_question_options for select
  using (
    exists (
      select 1 from public.quiz_questions
      join public.quizzes on quizzes.id = quiz_questions.quiz_id
      where quiz_questions.id = quiz_question_options.question_id
      and quizzes.user_id = auth.uid()
    )
  );

create policy "Users can insert options to their quiz questions"
  on public.quiz_question_options for insert
  with check (
    exists (
      select 1 from public.quiz_questions
      join public.quizzes on quizzes.id = quiz_questions.quiz_id
      where quiz_questions.id = quiz_question_options.question_id
      and quizzes.user_id = auth.uid()
    )
  );

create policy "Users can update options of their quiz questions"
  on public.quiz_question_options for update
  using (
    exists (
      select 1 from public.quiz_questions
      join public.quizzes on quizzes.id = quiz_questions.quiz_id
      where quiz_questions.id = quiz_question_options.question_id
      and quizzes.user_id = auth.uid()
    )
  );

create policy "Users can delete options of their quiz questions"
  on public.quiz_question_options for delete
  using (
    exists (
      select 1 from public.quiz_questions
      join public.quizzes on quizzes.id = quiz_questions.quiz_id
      where quiz_questions.id = quiz_question_options.question_id
      and quizzes.user_id = auth.uid()
    )
  );

-- Set up realtime
alter publication supabase_realtime add table quizzes;
alter publication supabase_realtime add table quiz_questions;
alter publication supabase_realtime add table quiz_question_options; 