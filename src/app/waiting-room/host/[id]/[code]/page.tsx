// app/waiting-room/host/[id]/[code]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Home, X, Link as LinkIcon, Users, Maximize2, Minimize2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import ConfirmationModal from '@/components/ConfirmationModal';
import ModalLoading from '@/app/components/ModalLoading';
import Link from 'next/link';

interface PresentSession {
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

export default function WaitingRoomHost({ params }: { params: { id: string; code: string } }) {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<PresentSession | null>(null);
  const [gameUrl, setGameUrl] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [playerToKick, setPlayerToKick] = useState<PlayerSession | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const setupHostSession = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace('/');
        return;
      }

      const storedSession = localStorage.getItem(`host_${params.code}`);
      if (storedSession) {
        const { sessionId: storedSessionId, playerSessionId: storedPlayerSessionId } = JSON.parse(storedSession);
        
        const { data: sessionData } = await supabase
          .from('present_sessions')
          .select('*')
          .eq('id', storedSessionId)
          .eq('status', 'waiting')
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
            setGameUrl(`${baseUrl}/waiting-room/play/${params.id}/${params.code}`);
            setIsLoading(false);
          }
        }
        else {
          localStorage.removeItem(`host_${params.code}`);
          localStorage.removeItem(`player_${params.code}`);
          console.log("Session data not found. Removing from local storage.");
        }
      }
      
      const { data: sessionData } = await supabase
        .from('present_sessions')
        .select('*')
        .eq('code', params.code)
        .single();

      if (sessionData) {
        const { data: newSession, error: joinError } = await supabase
          .rpc('join_crossword_session', {
            p_content_id: params.id,
            p_nickname: 'Host',
            p_is_host: true,
            p_session_type: sessionData.session_type,
            p_user_id: user.id,
            p_code: params.code
          });
  
        if (joinError) throw joinError;
  
        const { data: playerSession } = await supabase
          .from('player_sessions')
          .select('*')
          .eq('session_id', newSession)
          .eq('is_host', true)
          .single();
  
        console.log("New Session ID from RPC:", newSession);
        console.log("Player Session for Host:", playerSession);
        console.log("Crossword Session Data:", sessionData);
  
        if (playerSession) {
          localStorage.setItem(`host_${params.code}`, JSON.stringify({
            sessionId: newSession,
            playerSessionId: playerSession.id
          }));
  
          localStorage.setItem(`player_${params.code}`, JSON.stringify({
            sessionId: newSession,
            playerSessionId: playerSession.id,
            nickname: 'Host'
          }));
  
          console.log("Host session established and stored locally. Redirecting.");
          // router.replace(`/waiting-room/host/${params.id}/${newSession.code}`);
          // return;
        }
  
        setSessionId(newSession);
        setSession(sessionData);
  
        const baseUrl = window.location.origin;
        setGameUrl(`${baseUrl}/waiting-room/play/${params.id}/${params.code}`);
        setIsLoading(false);
      } else {
        setIsLoading(false);
        // console.log("Session data not found. Removing from local storage.");
        localStorage.removeItem(`host_${params.code}`);
        localStorage.removeItem(`player_${params.code}`);
        router.replace('/');
      }
    } catch (error) {
      console.error('Error setting up host session:', error);
      setIsLoading(false);
      router.replace('/');
    }
  };

  useEffect(() => {
    setupHostSession();
  }, [params.code, router, supabase]);

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
          if (payload.new) setSession(payload.new as PresentSession);
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
      const { data: sessionData, error: updateError } = await supabase
        .from('present_sessions')
        .update({
          status: 'in_progress',
          start_time: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select('*')
        .single();

      if (updateError) throw updateError;

      router.push(`/${sessionData.session_type}/${params.id}/${params.code}`); 
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
      <div className="min-h-screen bg-white flex items-center justify-center p-4 md:p-8">
        <ModalLoading isOpen={isLoading} redirect={true} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-white bg-[url('/Background.svg')] bg-repeat py-8">
      <div className="mx-auto px-4 flex flex-col justify-center items-center w-full">
        <Link href="/" className="text-4xl font-bold text-black mb-4 hover:text-gray-700 transition-all">
          hayolo.io
        </Link>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 min-h-[calc(100vh-8rem)] w-full max-w-[2000px]">
          {/* Left Column - QR Code */}
          <div className="md:col-span-3 flex justify-center items-start">
            <div className="bg-white p-6 rounded-xl border-2 border-black shadow-lg w-full sticky top-8">
              <h2 className="text-xl font-bold text-black mb-4 text-center">Scan to Join</h2>
              <div className="flex items-center justify-center p-4 bg-white border-2 border-dashed border-black rounded-lg">
                <QRCodeSVG
                  value={gameUrl}
                  size={Math.min(200, window.innerWidth - 80)}
                  level="H"
                  includeMargin
                />
              </div>
            </div>
          </div>

          {/* Middle Column - Host Panel */}
          <div className="md:col-span-6 flex flex-col">
            <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 border-2 border-black h-full flex flex-col">
              <div className="flex flex-col justify-between items-start mb-8 gap-4">
                <div className="w-full flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-black">Game Host Panel</h1>
                    <p className="text-gray-700 mt-2">
                      Status: <span className="font-semibold text-black">{session?.status === 'in_progress' ? 'Game in Progress' : 'Waiting for Players'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-black text-lg">
                      {!isFullscreen ? "Toggle Fullscreen" : "Exit Fullscreen"}
                    </span>
                    <button
                      onClick={toggleFullscreen}
                      className="p-2 rounded-lg border-2 border-black hover:bg-[#FFD34E] hover:text-white transition-all"
                      title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    >
                      {isFullscreen ? <Minimize2 color='black' className="w-5 h-5" /> : <Maximize2 color='black' className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-grow mb-8 p-4 md:p-6 bg-gray-50 rounded-xl border-2 border-black border-dashed shadow-sm">
                <h2 className="text-xl font-semibold text-black mb-4">Connected Players</h2>
                <div className="flex flex-wrap gap-4 items-center justify-center">
                  {players.map((player) => (
                    <span
                      key={player.id}
                      onClick={() => setPlayerToKick(player)} 
                      title={`Kick ${player.nickname}`}
                      className="flex items-center justify-between text-xl font-medium text-black hover:line-through transition-all duration-200 cursor-pointer px-4 py-2"
                    >
                      {player.nickname}
                    </span>
                  ))}
                  {players.length === 0 && (
                    <p className="text-gray-700 text-center py-4 w-full">
                      Waiting for players to join...
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-center mt-auto">
                <button
                  onClick={handleStartGame}
                  disabled={players.length === 0 || session?.status !== 'waiting'}
                  className={`px-6 py-3 text-lg font-medium rounded-lg transition-colors shadow-md ${
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

          {/* Right Column - Join Instructions */}
          <div className="md:col-span-3 flex justify-center items-start">
            <div className="bg-white p-6 rounded-xl border-2 border-black shadow-lg w-full sticky top-8">
              <h2 className="text-xl font-bold text-black mb-4">How to Join</h2>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg border-2 border-black">
                  <p className="text-lg font-semibold text-black mb-2">Game Code:</p>
                  <p className="text-3xl font-extrabold text-black text-center">{params.code}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-700">1. Go to <span className="font-semibold text-black">hayolo.io/join</span></p>
                  <p className="text-gray-700">2. Enter the game code above</p>
                  <p className="text-gray-700">3. Choose your nickname</p>
                  <p className="text-gray-700">4. Click Join Game</p>
                </div>
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border-2 border-black">
                  <p className="text-sm text-gray-700">Or scan the QR code on the left to join directly</p>
                </div>
              </div>
            </div>
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