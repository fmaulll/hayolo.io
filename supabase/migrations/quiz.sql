create table public.quizzes (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  title text not null,
  description text null,
  user_id uuid not null,
  is_published boolean null default false,
  total_points integer null default 0,
  constraint quizzes_pkey primary key (id),
  constraint quizzes_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.quiz_questions (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  quiz_id uuid not null,
  question_text text not null,
  question_type text not null,
  points integer null default 1,
  order_index integer not null,
  image_url text null,
  correct_answer text not null,
  time_limit integer not null default 30,
  user_id uuid null,
  constraint quiz_questions_pkey primary key (id),
  constraint quiz_questions_quiz_id_fkey foreign KEY (quiz_id) references quizzes (id) on delete CASCADE,
  constraint quiz_questions_question_type_check check (
    (
      question_type = any (
        array[
          'multiple_choice'::text,
          'yes_no'::text,
          'short_answer'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create table public.quiz_question_options (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  question_id uuid not null,
  option_text text not null,
  is_correct boolean null default false,
  order_index integer not null,
  constraint quiz_question_options_pkey primary key (id),
  constraint quiz_question_options_question_id_fkey foreign KEY (question_id) references quiz_questions (id) on delete CASCADE
) TABLESPACE pg_default;