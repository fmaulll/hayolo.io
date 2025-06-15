// app/crossword/leaderboard/[id]/[code]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trophy, Medal, Home, Share } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PlayerStats {
  nickname: string;
  completedWords: number;
  completionTime: string | null;
  rank: number;
}

interface CrosswordSession {
  id: string;
  content_id: string;
  status: 'waiting' | 'in_progress' | 'completed';
  start_time: string | null;
  code: string;
}

interface PlayerProgress {
  id: string;
  session_id: string;
  player_session_id: string;
  nickname: string;
  event: string;
  created_at: string;
}

export default function LeaderboardPage({ params }: { params: { id: string; code: string } }) {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [leaderboardData, setLeaderboardData] = useState<PlayerStats[]>([]);
  const [sessionData, setSessionData] = useState<CrosswordSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // First verify if the session exists and is completed
        const { data: session, error: sessionError } = await supabase
          .from('present_sessions')
          .select('*')
          .eq('content_id', params.id)
          .eq('code', params.code)
          .single();

        if (sessionError || !session) {
          toast.error('Session not found');
          router.push('/');
          return;
        }

        if (session.status !== 'completed') {
          // If session is not completed, redirect them back to the game
          router.push(`/crossword/${params.id}/${params.code}`);
          return;
        }

        setSessionData(session);

        // Fetch all progress data for this session
        const { data: progressData, error: progressError } = await supabase
          .from('player_progress')
          .select('*')
          .eq('session_id', session.id)
          .order('created_at', { ascending: true }); // Order by time to determine completion order

        if (progressError) throw progressError;

        if (progressData) {
          // Process player progress data
          const playerStats = progressData.reduce((acc, event) => {
            if (!acc[event.player_session_id]) {
              acc[event.player_session_id] = {
                nickname: event.nickname,
                completedWords: 0,
                completionTime: null
              };
            }

            if (event.event.startsWith('completed_word_')) {
              acc[event.player_session_id].completedWords++;
            }

            if (event.event === 'completed_puzzle' && !acc[event.player_session_id].completionTime) {
              acc[event.player_session_id].completionTime = event.created_at; // Record first completion time
            }

            return acc;
          }, {} as Record<string, Omit<PlayerStats, 'rank'>>);

          // Convert to array and sort by completion
          const sortedPlayers = (Object.values(playerStats) as Array<Omit<PlayerStats, 'rank'>>)
            .sort((a, b) => {
              // 1. Sort by number of completed words (descending)
              if (b.completedWords !== a.completedWords) {
                return b.completedWords - a.completedWords;
              }
              // 2. Then by puzzle completion time (ascending) - only if both completed
              if (a.completionTime && b.completionTime) {
                return new Date(a.completionTime).getTime() - new Date(b.completionTime).getTime();
              }
              // 3. Players who completed the puzzle rank higher than those who didn't
              if (a.completionTime) return -1; // a completed, b didn't
              if (b.completionTime) return 1;  // b completed, a didn't
              // 4. For those who didn't complete, fall back to alphabetical by nickname (stable sort)
              return a.nickname.localeCompare(b.nickname);
            })
            .map((player, index) => ({
              ...player,
              rank: index + 1
            }));

          setLeaderboardData(sortedPlayers);
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        toast.error('Failed to load leaderboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [params.id, params.code, router, supabase]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-none h-8 w-8 border-2 border-black mx-auto"></div>
          <p className="mt-4 text-black">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-black" />; // Black trophy
      case 2:
        return <Medal className="h-6 w-6 text-black" />; // Black medal
      case 3:
        return <Medal className="h-6 w-6 text-black" />; // Black medal
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-none shadow-lg p-6 mb-6 border border-black">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-black">Final Results</h1>
              <p className="text-gray-700 mt-2">
                Game Code: <span className="font-semibold text-black">{params.code}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-3"> {/* Use flex-wrap for mobile responsiveness */}
              <Link
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 bg-white border border-black rounded-none text-black hover:bg-gray-100 transition-colors duration-200 shadow-sm"
              >
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
              <button
                onClick={() => {
                  const url = window.location.href;
                  navigator.clipboard.writeText(url);
                  toast.success('Link copied to clipboard');
                }}
                className="inline-flex items-center px-4 py-2 bg-white border border-black rounded-none text-black hover:bg-gray-100 transition-colors duration-200 shadow-sm"
              >
                <Share className="h-4 w-4 mr-2" />
                Share
              </button>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white rounded-none shadow-lg p-6 border border-black">
          <div className="space-y-4">
            {leaderboardData.map((player) => (
              <div
                key={player.nickname}
                className={`p-4 rounded-none border border-black shadow-sm ${
                  player.rank === 1
                    ? 'bg-gray-100' // Subtle highlight for 1st
                    : player.rank === 2
                    ? 'bg-gray-50' // Subtle highlight for 2nd
                    : player.rank === 3
                    ? 'bg-gray-50' // Subtle highlight for 3rd
                    : 'bg-white'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"> {/* Flex-col for mobile */}
                  <div className="flex items-center gap-4">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-bold text-black
                      border border-black
                      ${player.rank === 1
                        ? 'bg-gray-200' // Darker gray for 1st rank circle background
                        : player.rank === 2
                        ? 'bg-gray-100'
                        : player.rank === 3
                        ? 'bg-gray-100'
                        : 'bg-white'
                      }
                    `}>
                      {getRankIcon(player.rank) || `#${player.rank}`}
                    </div>
                    <div>
                      <h3 className="font-semibold text-black">{player.nickname}</h3>
                      <div className="flex flex-wrap items-center gap-x-2 mt-1"> {/* Flex-wrap for mobile */}
                        <span className="text-sm text-gray-700">
                          {player.completedWords} words completed
                        </span>
                        {player.completionTime && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-sm text-gray-700">
                              Finished at {new Date(player.completionTime).toLocaleTimeString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {player.rank <= 3 && (
                    <div className="text-left sm:text-right w-full sm:w-auto mt-2 sm:mt-0"> {/* Text align adjusted for mobile */}
                      <div className="text-sm font-medium text-black">
                        {player.rank === 1 ? '🥇 Top Solver' : player.rank === 2 ? '🥈 Second Place' : '🥉 Third Place'}
                      </div>
                      <p className="text-xs text-gray-700">
                        {player.rank === 1 ? 'The fastest!' : player.rank === 2 ? 'Almost there!' : 'Great effort!'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {leaderboardData.length === 0 && (
              <div className="text-center py-8 bg-gray-50 rounded-none border border-black border-dashed shadow-sm">
                <p className="text-gray-700">No players found</p>
                <p className="text-gray-700 text-sm mt-2">Make sure the game session was completed!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}