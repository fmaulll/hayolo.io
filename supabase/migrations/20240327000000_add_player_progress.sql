-- Create player_progress table
CREATE TABLE public.player_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.crossword_sessions(id) ON DELETE CASCADE,
  player_session_id UUID NOT NULL REFERENCES public.player_sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  event TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Add index for better query performance but NOT unique
  CREATE INDEX player_progress_session_player_idx ON public.player_progress (session_id, player_session_id)
);

-- Enable realtime for the table
ALTER publication supabase_realtime ADD TABLE player_progress;

-- Add RLS policies
ALTER TABLE public.player_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.player_progress
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow insert for session players"
  ON public.player_progress
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.player_sessions
      WHERE id = player_progress.player_session_id
      AND session_id = player_progress.session_id
    )
  ); 