'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home } from 'lucide-react';
import toast from 'react-hot-toast';
import ModalLoading from '@/app/components/ModalLoading';

interface CrosswordSession {
  id: string;
  content_id: string;
  status: 'waiting' | 'in_progress' | 'completed';
  start_time: string | null;
  code: string;
}

interface PlayerSession {
  id: string;
  session_id: string;
  nickname: string;
  is_host: boolean;
  joined_at: string;
}

interface Puzzle {
  id: string;
  name: string;
}

export default function WaitingRoomPlayPage({ params }: { params: { id: string; code: string } }) {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [showNicknameInput, setShowNicknameInput] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<CrosswordSession | null>(null);
  const [playerSessionId, setPlayerSessionId] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Check local storage for existing session
        const storedSession = localStorage.getItem(`crossword_player_${params.code}`);
        if (storedSession) {
          const { sessionId: storedSessionId, playerSessionId: storedPlayerSessionId, nickname: storedNickname } = JSON.parse(storedSession);
          
          // Verify if the stored session is still valid and matches the code
          const { data: sessionData } = await supabase
            .from('present_sessions')
            .select('*')
            .eq('id', storedSessionId)
            .eq('code', params.code)
            .single();

          if (sessionData) {
            const { data: playerSession } = await supabase
              .from('player_sessions')
              .select('*')
              .eq('id', storedPlayerSessionId)
              .single();

            if (playerSession) {
              setSessionId(storedSessionId);
              setPlayerSessionId(storedPlayerSessionId);
              setNickname(storedNickname);
              setShowNicknameInput(false);
              setSession(sessionData);
            } else {
              // Clear invalid session from local storage
              localStorage.removeItem(`crossword_player_${params.code}`);
            }
          } else {
            // Clear invalid session from local storage
            localStorage.removeItem(`crossword_player_${params.code}`);
          }
        }

        // Find active session with matching code
        const { data: sessionData, error: sessionError } = await supabase
          .from('present_sessions')
          .select('*')
          .eq('content_id', params.id)
          .eq('code', params.code)
          .eq('status', 'waiting')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!sessionError && sessionData) {
          setSession(sessionData);
          setSessionId(sessionData.id);

          // Fetch current players
          const { data: playersData } = await supabase
            .from('player_sessions')
            .select('*')
            .eq('session_id', sessionData.id)
            .eq('is_host', false);

          if (playersData) {
            setPlayers(playersData);
          }
        } else {
          // If no valid session found, redirect to home
          router.replace('/');
          return;
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setIsLoading(false);
        router.replace('/');
      }
    };

    fetchInitialData();
  }, [params.id, params.code, router, supabase]);

  useEffect(() => {
    if (!sessionId) return;

    // Set up real-time subscriptions with unique channel names
    const sessionChannel = supabase.channel(`game_session:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'present_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          if (payload.new) {
            const newSession = payload.new as CrosswordSession;
            setSession(newSession);
            
            // Redirect to game when it starts
            if (newSession.status === 'in_progress') {
              router.push(`/crossword/${params.id}/${params.code}`);
            }
          }
        }
      )
      .subscribe();

    const playersChannel = supabase.channel(`game_players:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player_sessions',
          filter: `session_id=eq.${sessionId}`
        },
        async (payload) => {
          console.log('Received player update:', payload);
          if (payload.eventType === 'INSERT') {
            setPlayers(current => [...current, payload.new as PlayerSession]);
          } else if (payload.eventType === 'UPDATE') {
            setPlayers(current =>
              current.map(p => p.id === payload.new.id ? payload.new as PlayerSession : p)
            );
          } else if (payload.eventType === 'DELETE') {
            // If the deleted player is the current player, show nickname input
            if (payload.old.id === playerSessionId) {
              localStorage.removeItem(`crossword_player_${params.code}`);
              setShowNicknameInput(true);
              setPlayerSessionId(null);
              toast.error('You have been removed from the game');
            }
            setPlayers(current =>
              current.filter(p => p.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      sessionChannel.unsubscribe();
      playersChannel.unsubscribe();
    };
  }, [sessionId, params.id, router, supabase, playerSessionId]);

  const handleJoinGame = async () => {
    if (!nickname.trim()) {
      toast.error('Please enter a nickname');
      return;
    }

    try {
      const { data: newSession, error: joinError } = await supabase
        .rpc('join_crossword_session', {
          p_content_id: params.id,
          p_nickname: nickname,
          p_is_host: false,
          p_session_type: 'crossword',
          p_user_id: null,
          p_code: params.code
        });

      if (joinError) throw joinError;

      // Get the player session ID
      const { data: playerSession } = await supabase
        .from('player_sessions')
        .select('*')
        .eq('session_id', newSession)
        .eq('nickname', nickname)
        .single();

      if (playerSession) {
        // Store session info in local storage
        localStorage.setItem(`crossword_player_${params.code}`, JSON.stringify({
          sessionId: newSession,
          playerSessionId: playerSession.id,
          nickname
        }));

        setSessionId(newSession);
        setPlayerSessionId(playerSession.id);
        setShowNicknameInput(false);
        toast.success('Successfully joined the game');
      }
    } catch (error) {
      console.error('Error joining game:', error);
      toast.error('Failed to join game');
    }
  };


  if (isLoading) { // Ensure puzzle data is loaded too
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 md:p-8">
        <ModalLoading isOpen={isLoading} redirect={true} />
      </div>
    );
  }

  if (showNicknameInput) {
    return (
      <div className="min-h-screen bg-white bg-[url('/background-seamless.png')] bg-repeat flex items-center justify-center p-4 md:p-8">
        <div className="max-w-md w-full bg-white p-8 rounded-none shadow-lg border-2 border-black">
          <h2 className="text-2xl font-bold mb-6 text-black">Join Crossword Game</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-black">
                Your Nickname
              </label>
              <input
                type="text"
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="mt-1 w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200 text-black"
                placeholder="Enter your nickname"
                maxLength={20}
              />
            </div>
            <button
              onClick={handleJoinGame}
              className="w-full py-2 px-4 border-2 border-black rounded-none shadow-md text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-0"
            >
              Join Game
            </button>
            <button
                onClick={() => router.replace('/')}
                className="w-full py-2 px-4 border-2 border-black rounded-none shadow-sm text-sm font-medium text-black hover:bg-gray-100 focus:outline-none focus:ring-0"
            >
                Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white bg-[url('/background-seamless.png')] bg-repeat flex items-center justify-center p-4 md:p-8">
      <div className="max-w-md w-full bg-white p-8 rounded-none shadow-lg border-2 border-black">
        <h2 className="text-2xl font-bold mb-6 text-black">Waiting Room</h2>
        <p className="text-gray-700 text-center mb-4">
            Game Code: <span className="font-extrabold text-black text-xl">{params.code}</span>
        </p>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-black mb-4">Players</h3>
            <div className="space-y-2">
              {players.length === 0 && (
                  <p className="text-gray-700 text-center py-4 border-2 border-dashed border-black rounded-none">
                      No players yet.
                  </p>
              )}
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-none border-2 border-black shadow-sm"
                >
                  <span className="font-medium text-black">
                    {player.nickname}
                    {player.is_host && (
                      <span className="ml-2 text-xs bg-gray-100 text-black px-2 py-1 rounded-none border-2 border-black">
                        Host
                      </span>
                    )}
                  </span>
                  {player.id === playerSessionId && (
                      <span className="text-xs bg-gray-100 text-black px-2 py-1 rounded-none border-2 border-black">You</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-center text-gray-700 border-2 border-dashed border-black p-4 rounded-none">
            Waiting for the host to start the game...
          </div>
        </div>
      </div>
    </div>
  );
}