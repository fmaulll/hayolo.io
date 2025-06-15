// app/crossword/host/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Home, X, Link as LinkIcon, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import ConfirmationModal from '@/components/ConfirmationModal';

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
  user_id: string;
}

export default function CrosswordHostPage({ params }: { params: { id: string; code: string } }) {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerSession[]>([]);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<CrosswordSession | null>(null);
  const [gameUrl, setGameUrl] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [playerToKick, setPlayerToKick] = useState<PlayerSession | null>(null);

  useEffect(() => {
    const setupHostSession = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.replace('/');
          return;
        }

        const storedSession = localStorage.getItem(`crossword_host_${params.id}`);
        if (storedSession) {
          const { sessionId: storedSessionId, playerSessionId: storedPlayerSessionId } = JSON.parse(storedSession);
          
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
              setSession(sessionData);
              const baseUrl = window.location.origin;
              setGameUrl(`${baseUrl}/crossword/play/${params.id}/${params.code}`);
              setIsLoading(false);
            }
          }
        }

        const { data: puzzleData, error: puzzleError } = await supabase
          .from('crosswords')
          .select('*')
          .eq('id', params.id)
          .single();

        if (puzzleError) throw puzzleError;

        if (puzzleData.user_id !== user.id) {
          router.replace(`${gameUrl}`);
          return;
        }

        setPuzzle(puzzleData);

        const { data: newSession, error: joinError } = await supabase
          .rpc('join_crossword_session', {
            p_content_id: params.id,
            p_nickname: 'Host',
            p_is_host: true,
            p_session_type: 'crossword',
            p_user_id: user.id
          });

        if (joinError) throw joinError;
        
        const { data: sessionData } = await supabase
          .from('present_sessions')
          .select('*')
          .eq('id', newSession.session_id)
          .single();

        const { data: playerSession } = await supabase
          .from('player_sessions')
          .select('*')
          .eq('session_id', newSession.session_id)
          .eq('is_host', true)
          .single();

        console.log("New Session ID from RPC:", newSession.session_id);
        console.log("Player Session for Host:", playerSession);
        console.log("Crossword Session Data:", sessionData);

        if (playerSession && sessionData) {
          localStorage.setItem(`crossword_host_${params.id}`, JSON.stringify({
            sessionId: newSession.session_id,
            playerSessionId: playerSession.id
          }));

          localStorage.setItem(`crossword_player_${params.id}`, JSON.stringify({
            sessionId: newSession.session_id,
            playerSessionId: playerSession.id,
            nickname: 'Host'
          }));

          console.log("Host session established and stored locally. Redirecting.");
          router.replace(`/crossword/host/${params.id}/${sessionData.code}`);
          return;
        }

        setSessionId(newSession.session_id);
        setSession(sessionData);

        const baseUrl = window.location.origin;
        setGameUrl(`${baseUrl}/crossword/play/${params.id}/${sessionData.code}`);

        setIsLoading(false);
      } catch (error) {
        console.error('Error setting up host session:', error);
        setIsLoading(false);
        router.replace('/');
      }
    };

    setupHostSession();
  }, [params.id, params.code, router, supabase]);

  useEffect(() => {
    if (!sessionId) return;

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
          if (payload.new) setSession(payload.new as CrosswordSession);
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
        (payload) => {
          console.log('Received player update:', payload);
          if (payload.eventType === 'INSERT') {
            setPlayers(current => [...current, payload.new as PlayerSession]);
            toast.success(`${payload.new.nickname} joined the game`);
          } else if (payload.eventType === 'UPDATE') {
            setPlayers(current =>
              current.map(p => p.id === payload.new.id ? payload.new as PlayerSession : p)
            );
          } else if (payload.eventType === 'DELETE') {
            setPlayers(current =>
              current.filter(p => p.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    const fetchPlayers = async () => {
      const { data } = await supabase
        .from('player_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .eq('is_host', false);

      if (data) setPlayers(data);
    };

    fetchPlayers();

    return () => {
      sessionChannel.unsubscribe();
      playersChannel.unsubscribe();
    };
  }, [sessionId, supabase]);

  const handleStartGame = async () => {
    if (!sessionId) return;

    try {
      const { error: updateError } = await supabase
        .from('present_sessions')
        .update({
          status: 'in_progress',
          start_time: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      router.push(`/crossword/${params.id}/${params.code}`); 
    } catch (error) {
      console.error('Error starting game:', error);
      toast.error('Failed to start game');
    }
  };

  const handleKickPlayer = async () => {
    if (!playerToKick) return;

    try {
      const { error } = await supabase
        .from('player_sessions')
        .delete()
        .eq('id', playerToKick.id);

      if (error) throw error;
      toast.success(`${playerToKick.nickname} has been removed from the game`);
      setPlayerToKick(null);
    } catch (error) {
      console.error('Error kicking player:', error);
      toast.error('Failed to remove player from the game');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-none h-8 w-8 border-2 border-black mx-auto"></div>
          <p className="mt-4 text-black">Setting up game session...</p>
        </div>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-none shadow-lg border-2 border-black">
          <p className="text-black mb-4">Puzzle not found</p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center px-4 py-2 bg-black text-white rounded-none hover:bg-gray-800 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-none shadow-lg p-6 md:p-8 border-2 border-black">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 md:gap-0">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-black">Game Host Panel</h1>
              <p className="text-gray-700 mt-2">
                Status: <span className="font-semibold text-black">{session?.status === 'in_progress' ? 'Game in Progress' : 'Waiting for Players'}</span>
              </p>
              {/* Display the Game Code here */}
              <p className="text-gray-700 mt-1">
                Game Code: <span className="font-extrabold text-black text-xl md:text-2xl">{params.code}</span>
              </p>
            </div>
            <button
              onClick={() => setShowQRCode(!showQRCode)}
              className="px-4 py-2 text-sm font-medium text-black bg-gray-100 rounded-none hover:bg-gray-200 border-2 border-black transition-colors shadow-sm"
            >
              <LinkIcon className="w-4 h-4 inline-block mr-1" />
              {showQRCode ? 'Hide Join Link' : 'Show Join Link'}
            </button>
          </div>

          {showQRCode && (
            <div className="mb-8 p-6 bg-gray-50 rounded-none border-2 border-black border-dashed shadow-sm">
              <h2 className="text-lg font-semibold text-black mb-4">Share Game Link</h2>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <input
                  type="text"
                  readOnly
                  value={gameUrl}
                  className="flex-1 w-full p-3 bg-white border-2 border-black rounded-none text-black text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(gameUrl);
                    toast.success('Game link copied to clipboard');
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-black rounded-none hover:bg-gray-800 transition-colors shadow-sm"
                >
                  Copy
                </button>
              </div>
               <div className="mt-4 flex items-center justify-center p-4 bg-white border-2 border-dashed border-black rounded-none">
                 <QRCodeSVG
                   value={gameUrl}
                   size={Math.min(200, window.innerWidth - 80)}
                   level="H"
                   includeMargin
                 />
               </div>
            </div>
          )}

          <div className="mb-8 p-4 md:p-6 bg-gray-50 rounded-none border-2 border-black border-dashed shadow-sm">
            <h2 className="text-xl font-semibold text-black mb-4">Connected Players</h2>
            <div className="space-y-3">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 bg-white rounded-none border-2 border-black group shadow-sm"
                >
                  <span className="font-medium text-black">{player.nickname}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-700">
                      {new Date(player.joined_at).toLocaleTimeString()}
                    </span>
                    {!player.is_host && (
                      <button
                        onClick={() => setPlayerToKick(player)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-black hover:text-gray-700 p-1 rounded-none border-2 border-transparent hover:border-black"
                        title={`Kick ${player.nickname}`}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                     {player.is_host && (
                       <span className="text-black text-sm border-2 border-black px-2 py-0.5 rounded-none">Host</span>
                     )}
                  </div>
                </div>
              ))}
              {players.length === 0 && (
                <p className="text-gray-700 text-center py-4">
                  Waiting for players to join...
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleStartGame}
              disabled={players.length === 0 || session?.status !== 'waiting'}
              className={`px-6 py-3 text-lg font-medium rounded-none transition-colors shadow-md ${
                players.length === 0 || session?.status !== 'waiting'
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed border-2 border-black'
                  : 'bg-black text-white hover:bg-gray-800 border-2 border-black'
              }`}
            >
              Start Game
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!playerToKick}
        onClose={() => setPlayerToKick(null)}
        onConfirm={handleKickPlayer}
        title="Remove Player"
        message={`Are you sure you want to remove ${playerToKick?.nickname} from the game?`}
        confirmText="Remove"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}