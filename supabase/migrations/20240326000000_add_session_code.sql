-- Add code column to crossword_sessions
ALTER TABLE public.crossword_sessions
ADD COLUMN code TEXT NOT NULL DEFAULT substring(md5(random()::text), 1, 6);

-- Add unique constraint to ensure no duplicate codes for active sessions
CREATE UNIQUE INDEX unique_active_session_code ON public.crossword_sessions (code) 
WHERE status != 'completed'; 