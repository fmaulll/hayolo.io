-- Add delete policy for player_sessions
create policy "Host can delete player sessions" on public.player_sessions
  for delete using (
    exists (
      select 1 from public.crossword_sessions cs
      join public.crosswords c on c.id = cs.crossword_id
      join public.player_sessions ps on ps.session_id = cs.id
      where ps.session_id = player_sessions.session_id
      and ps.is_host = true
      and c.user_id = auth.uid()
    )
  ); 