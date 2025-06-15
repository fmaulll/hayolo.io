'use client';

import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, RotateCcw, CheckCircle, Home, Lightbulb, LinkIcon, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';

interface CrosswordEntry {
  question: string;
  answer: string;
}

interface Puzzle {
  id: string;
  name: string;
  entries: CrosswordEntry[];
  grid: GridCell[][];
  placed_words: PlacedWord[];
  created_at: string;
}

interface PlacedWord {
  word: string;
  question: string;
  row: number;
  col: number;
  direction: 'horizontal' | 'vertical';
  number: number;
}

interface GridCell {
  letter: string;
  isBlack: boolean;
  number?: number;
  belongsToWords: number[];
}

interface SelectedCell {
  row: number;
  col: number;
  words: {
    number: number;
    direction: 'horizontal' | 'vertical';
    word: string;
    question: string;
  }[];
}

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

interface PlayerProgress {
  id: string;
  session_id: string;
  player_session_id: string;
  nickname: string;
  event: string;
  created_at: string;
}

interface Player {
  id: string;
  nickname: string;
  is_host: boolean;
}

interface FirstSolvers {
  [key: number]: string; // word_number -> player_session_id
}

interface PlayerWordProgress {
  [key: string]: number[]; // player_session_id -> array of completed word numbers
}

interface Word {
  number: number;
  direction: 'horizontal' | 'vertical';
  word: string;
  question: string;
}

interface PlayerStats {
  nickname: string;
  completedWords: number;
  completionTime: string | null;
}

const isCrosswordSession = (obj: any): obj is CrosswordSession => {
  return obj && 
    typeof obj.id === 'string' &&
    typeof obj.content_id === 'string' &&
    typeof obj.status === 'string' &&
    (obj.status === 'waiting' || obj.status === 'in_progress' || obj.status === 'completed') &&
    (obj.start_time === null || typeof obj.start_time === 'string');
};

export default function CrosswordGamePage({ params }: { params: { id: string; code: string } }) {
  const supabase = createClientComponentClient();
  const [nickname, setNickname] = useState('');
  const [tempId, setTempId] = useState('');
  const [showNicknameInput, setShowNicknameInput] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerSession[]>([]);
  const [firstSolvers, setFirstSolvers] = useState<FirstSolvers>({});
  const [playerProgress, setPlayerProgress] = useState<PlayerProgress[]>([]);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [grid, setGrid] = useState<GridCell[][]>([]);
  const [userGrid, setUserGrid] = useState<string[][]>([]);
  const [placedWords, setPlacedWords] = useState<PlacedWord[]>([]);
  const [completedWords, setCompletedWords] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showInputModal, setShowInputModal] = useState(false);
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<'horizontal' | 'vertical' | null>('horizontal');
  const [showHint, setShowHint] = useState<number | null>(null);
  const [gameComplete, setGameComplete] = useState(false);
  const [session, setSession] = useState<CrosswordSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [countdownTime, setCountdownTime] = useState<number | null>(null);
  const router = useRouter();
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [modalInputs, setModalInputs] = useState<string[]>([]);
  const modalInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(null);
  const [mobileTab, setMobileTab] = useState<'grid' | 'clues'>('grid');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<{
    nickname: string;
    completedWords: number;
    completionTime: string | null;
    rank: number;
  }[]>([]);

  // Get the full URL for QR code
  const boardUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/crossword/${params.id}/${params.code}`
    : '';

  const startCountdown = () => {
    let count = 5;
    setCountdownTime(count);
    
    const interval = setInterval(() => {
      count--;
      setCountdownTime(count);
      
      if (count === 0) {
        clearInterval(interval);
        setCountdownTime(null);
      }
    }, 1000);
  };

  const handleCellClick = (row: number, col: number) => {
    const cell = grid[row][col];
    if (cell.isBlack) return;

    const words = cell.belongsToWords.map(number => {
      const placedWord = placedWords.find(w => w.number === number);
      return {
        number,
        direction: placedWord!.direction,
        word: placedWord!.word,
        question: placedWord!.question
      };
    });

    // Filter out completed words
    const remainingWords = words.filter(word => !completedWords.has(word.number));
    
    if (remainingWords.length === 0) return; // All words are completed
    
    setSelectedCell({ row, col, words: remainingWords });
    
    if (remainingWords.length === 1) {
      // Only one word left to complete
      const word = remainingWords[0];
      setSelectedDirection(word.direction);
      
      // Find the placed word to get starting position
      const placedWord = placedWords.find(w => w.number === word.number);
      if (!placedWord) return;
      
      // Pre-fill the modal inputs with any completed letters
      const inputs = Array(word.word.length).fill('');
      for (let i = 0; i < word.word.length; i++) {
        const letterRow = placedWord.direction === 'horizontal' ? placedWord.row : placedWord.row + i;
        const letterCol = placedWord.direction === 'horizontal' ? placedWord.col + i : placedWord.col;
        if (userGrid[letterRow][letterCol]) {
          inputs[i] = userGrid[letterRow][letterCol];
        }
      }
      setModalInputs(inputs);
    } else {
      setSelectedDirection(null);
    }
    
    setShowInputModal(true);
  };

  const toggleHint = (wordNumber: number) => {
    setShowHint(showHint === wordNumber ? null : wordNumber);
  };

  const selectDirection = (direction: 'horizontal' | 'vertical') => {
    setSelectedDirection(direction);
    if (selectedCell) {
      const word = selectedCell.words.find(w => w.direction === direction);
      if (word) {
        // Find the placed word to get starting position
        const placedWord = placedWords.find(w => w.number === word.number);
        if (!placedWord) return;
        
        // Pre-fill the modal inputs with any completed letters
        const inputs = Array(word.word.length).fill('');
        for (let i = 0; i < word.word.length; i++) {
          const row = placedWord.direction === 'horizontal' ? placedWord.row : placedWord.row + i;
          const col = placedWord.direction === 'horizontal' ? placedWord.col + i : placedWord.col;
          if (userGrid[row][col]) {
            inputs[i] = userGrid[row][col];
          }
        }
        setModalInputs(inputs);
      }
    }
  };

  const handleModalInput = (index: number, value: string) => {
    const newInputs = [...modalInputs];
    newInputs[index] = value.toUpperCase();
    setModalInputs(newInputs);

    // Find next empty input
    if (value) {
      let nextIndex = index + 1;
      while (nextIndex < modalInputs.length) {
        if (!modalInputs[nextIndex]) {
          modalInputRefs.current[nextIndex]?.focus();
          break;
        }
        nextIndex++;
      }
    }

    // Check if word is complete
    if (newInputs.every(input => input)) {
      const word = selectedCell!.words.find(w => w.direction === selectedDirection);
      if (word && newInputs.join('') === word.word) {
        // Find the starting position of the word
        const placedWord = placedWords.find(w => w.number === word.number);
        if (!placedWord) return;

        // Update the grid with the correct letters
        const newUserGrid = [...userGrid];
        for (let i = 0; i < word.word.length; i++) {
          const row = placedWord.direction === 'horizontal' ? placedWord.row : placedWord.row + i;
          const col = placedWord.direction === 'horizontal' ? placedWord.col + i : placedWord.col;
          newUserGrid[row][col] = word.word[i];
        }
        setUserGrid(newUserGrid);
        
        // Add to completed words
        setCompletedWords(prev => new Set(Array.from(prev).concat(word.number)));
        
        // Close the modal
        setShowInputModal(false);
        setSelectedCell(null);
        setSelectedDirection('horizontal');
        
        // Record completion
        handleWordComplete(word.number);
      }
    }
  };

  const handleClueClick = (word: PlacedWord) => {
    // Find the starting cell of the word
    const row = word.row;
    const col = word.col;
    handleCellClick(row, col);
  };

  useEffect(() => {
    const validateSession = async () => {
      try {
        // Check both host and player storage
        const hostStoredSession = localStorage.getItem(`crossword_host_${params.code}`);
        const playerStoredSession = localStorage.getItem(`crossword_player_${params.code}`);

        if (!hostStoredSession && !playerStoredSession) {
          router.replace('/');
          return;
        }

        let sessionId: string;
        let playerSessionId: string;

        // If host storage exists, use that
        if (hostStoredSession) {
          const hostData = JSON.parse(hostStoredSession);
          sessionId = hostData.sessionId;
          playerSessionId = hostData.playerSessionId;
          setIsHost(true);
        } else {
          // Otherwise use player storage
          const playerData = JSON.parse(playerStoredSession!);
          sessionId = playerData.sessionId;
          playerSessionId = playerData.playerSessionId;
          setIsHost(false);
        }

        // Verify if the session exists and matches the code
        const { data: sessionData, error: sessionError } = await supabase
          .from('present_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('code', params.code)
          .eq('status', 'in_progress')
          .single();

        if (sessionError || !sessionData) {
          router.replace('/');
          return;
        }

        setSession(sessionData);

        // Verify if the player session exists
        const { data: playerSessionData, error: playerError } = await supabase
          .from('player_sessions')
          .select('*')
          .eq('id', playerSessionId)
          .single();

        if (playerError || !playerSessionData) {
          router.replace('/');
          return;
        }

        setPlayerSession(playerSessionData);

        // Store the current player session info for progress tracking
        localStorage.setItem(`crossword_current_player_session_${params.id}`, JSON.stringify({
          sessionId: sessionData.id,
          playerSessionId: playerSessionData.id,
          nickname: playerSessionData.nickname
        }));

        // Fetch initial player progress
        const { data: progressData } = await supabase
          .from('player_progress')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (progressData) {
          setPlayerProgress(progressData);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error validating session:', error);
        router.replace('/');
      }
    };

    validateSession();
  }, [params.id, params.code, router, supabase]);

  useEffect(() => {
    const fetchPuzzleAndLoadProgress = async () => {
      if (!session || !playerSession) return;
      
      try {
        const { data: puzzle, error } = await supabase
          .from('crosswords')
          .select('*')
          .eq('id', params.id)
          .single();

        if (error) throw error;
        if (!puzzle) {
          console.error('Puzzle not found');
          return;
        }

        setPuzzle(puzzle);
        setGrid(puzzle.grid);
        setPlacedWords(puzzle.placed_words);
        
        // Load user progress from localStorage
        const savedProgressKey = `crossword_game_progress_${params.id}_${playerSession.id}`;
        const savedProgress = localStorage.getItem(savedProgressKey);

        let initialUserGrid = Array(puzzle.grid.length).fill(null).map(() =>
          Array(puzzle.grid[0].length).fill('')
        );
        let initialCompletedWords = new Set<number>();

        if (savedProgress) {
          const parsedProgress = JSON.parse(savedProgress);
          // Check if the saved session ID matches the current one
          const currentSessionInfo = JSON.parse(localStorage.getItem(`crossword_current_player_session_${params.id}`) || '{}');
          if (parsedProgress.sessionId === currentSessionInfo.sessionId && parsedProgress.playerSessionId === currentSessionInfo.playerSessionId) {
            initialUserGrid = parsedProgress.userGrid || initialUserGrid;
            initialCompletedWords = new Set(parsedProgress.completedWords || []);
            toast.success('Loaded saved progress!');
          } else {
            // If session ID or player session ID mismatch, clear old progress
            localStorage.removeItem(savedProgressKey);
            toast.success('Starting new session. Old progress cleared.');
          }
        }
        
        setUserGrid(initialUserGrid);
        setCompletedWords(initialCompletedWords);
        
      } catch (error) {
        console.error('Error fetching puzzle:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPuzzleAndLoadProgress();
  }, [params.id, session, playerSession, supabase]); // Added playerSession to dependencies

  // Save userGrid and completedWords to localStorage whenever they change
  useEffect(() => {
    if (userGrid.length > 0 && playerSession) {
      const savedProgressKey = `crossword_game_progress_${params.id}_${playerSession.id}`;
      localStorage.setItem(savedProgressKey, JSON.stringify({
        sessionId: session?.id, // Save current session ID for verification
        playerSessionId: playerSession.id,
        userGrid: userGrid,
        completedWords: Array.from(completedWords)
      }));
    }
  }, [userGrid, completedWords, params.id, playerSession, session]);


  useEffect(() => {
    if (!session) return;

    // Subscribe to player progress updates
    const progressChannel = supabase.channel(`progress:${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player_progress',
          filter: `session_id=eq.${session.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPlayerProgress(current => [...current, payload.new as PlayerProgress]);
          }
        }
      )
      .subscribe();

    return () => {
      progressChannel.unsubscribe();
    };
  }, [session, supabase]);

  useEffect(() => {
    if (!session) return;

    // Subscribe to session status changes
    const sessionChannel = supabase.channel(`session:${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'present_sessions',
          filter: `id=eq.${session.id}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedSession = payload.new as CrosswordSession;
            if (updatedSession.status === 'completed') {
              // Redirect to leaderboard
              router.push(`/crossword/leaderboard/${params.id}/${params.code}`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      sessionChannel.unsubscribe();
    };
  }, [session, router, params.id, params.code, supabase]);

  const handleWordComplete = async (wordNumber: number) => {
    if (!session || !playerSession) return;

    try {
      // Check if we've already recorded this word completion
      const alreadyCompleted = playerProgress.some(p => 
        p.player_session_id === playerSession.id && 
        p.event === `completed_word_${wordNumber}`
      );

      if (!alreadyCompleted) {
        // Record the word completion in player progress
        await supabase.from('player_progress').insert({
          session_id: session.id,
          player_session_id: playerSession.id,
          nickname: playerSession.nickname,
          event: `completed_word_${wordNumber}`
        });

        // Check if all words are completed (based on the current local state of completedWords set)
        // Note: The `playerProgress` state might not be immediately updated from Supabase,
        // so `completedWords.size` is a more reliable local count.
        if (completedWords.size + 1 === placedWords.length) { // Add 1 for the current completion
          // Check if we've already recorded puzzle completion
          const alreadyFinished = playerProgress.some(p =>
            p.player_session_id === playerSession.id &&
            p.event === 'completed_puzzle'
          );

          if (!alreadyFinished) {
            // Record game completion
            await supabase.from('player_progress').insert({
              session_id: session.id,
              player_session_id: playerSession.id,
              nickname: playerSession.nickname,
              event: 'completed_puzzle'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const subscribeToGameUpdates = (gameSessionId: string) => {
    // Subscribe to real-time updates for the game session
    const channel = supabase.channel(`game_${gameSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player_progress',
          filter: `session_id=eq.${gameSessionId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const progress = payload.new as PlayerProgress;
            setPlayerProgress(current => [...current, progress]);

            // If someone completed the puzzle, show a notification
            if (progress.event === 'completed_puzzle') {
              toast.success(`${progress.nickname} completed the puzzle!`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const updateGameState = (payload: RealtimePostgresChangesPayload<any>) => {
    const { eventType, new: newData, old: oldData } = payload;
    
    switch (eventType) {
      case 'INSERT':
        // Handle new player joining
        setPlayers(prev => [...prev, newData as PlayerSession]);
        break;
      case 'UPDATE':
        // Handle player status updates (ready state, etc.)
        setPlayers(prev => prev.map(p => 
          p.id === newData.id ? { ...p, ...newData } as PlayerSession : p
        ));
        break;
      case 'DELETE':
        // Handle player leaving
        setPlayers(prev => prev.filter(p => p.id !== oldData.id));
        break;
    }
  };

  const updateProgressState = (payload: RealtimePostgresChangesPayload<any>) => {
    const { eventType, new: newData } = payload;
    
    if (eventType === 'INSERT') {
      // Update completed words and first solver tracking
      if (newData.is_first_solver) {
        setFirstSolvers(prev => ({
          ...prev,
          [newData.word_number]: newData.player_session_id
        }));
      }
      
      // Update player progress
      setPlayerProgress(prev => [...prev, newData as PlayerProgress]);
    }
  };

  const recordProgress = async (event: string) => {
    if (!session || !playerSession) return;

    try {
      await supabase
        .from('player_progress')
        .upsert({
          session_id: session.id,
          player_session_id: playerSession.id,
          nickname: playerSession.nickname,
          event: event
        });
    } catch (error) {
      console.error('Error recording progress:', error);
    }
  };

  const handleEndSession = async () => {
    if (!session || !isHost) return;

    try {
      // Update session status to completed
      const { error: updateError } = await supabase
        .from('present_sessions')
        .update({ status: 'completed' })
        .eq('id', session.id);

      if (updateError) throw updateError;

      const { error: deleteError } = await supabase
      .from('player_sessions') // Replace 'your_table_name' with the actual name of your table
      .delete()
      .eq('session_id', session.id); // Filter by the session_id column

      if (deleteError) throw deleteError;

      // Redirect to leaderboard
      router.push(`/crossword/leaderboard/${params.id}/${params.code}`);
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('Failed to end session');
    }
  };

  if (isLoading || !puzzle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading game...</p>
        </div>
      </div>
    );
  }

  const isComplete = completedWords.size === placedWords.length;

  if (countdownTime !== null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-6xl font-bold text-gray-900 mb-4">
            Starting in {countdownTime}
          </h2>
          <p className="text-gray-600">Get ready to solve!</p>
        </div>
      </div>
    );
  }

  const renderPlayerProgress = () => {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Player Progress</h3>
        <div className="space-y-3">
          {playerProgress.map((progress) => (
            <div
              key={progress.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div>
                <span className="font-medium text-gray-900">{progress.nickname}</span>
                <span className="ml-2 text-gray-500">{progress.event}</span>
              </div>
              <span className="text-sm text-gray-500">
                {new Date(progress.created_at).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-white">
  {/* Header */}
  <header className="bg-white border-b-2 border-black shadow-sm">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center h-16">
        <Link
          href="/dashboard" // Assuming /dashboard is the home for authenticated users
          className="flex items-center gap-2 text-black font-bold text-xl hover:text-gray-800 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
          </svg>
          QuestionBoard
        </Link>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowQRModal(true)}
            className="inline-flex items-center gap-2 text-black hover:text-gray-800 transition-colors"
          >
            <LinkIcon className="w-5 h-5" />
            Share
          </button>
          {playerSession?.nickname && (
            <span className="text-black text-sm font-semibold">
              {playerSession.nickname} {isHost ? '(Host)' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  </header>
  <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* {session?.status !== 'waiting' && renderPlayerProgress()} Only render progress during game or if host */}

        {session?.status === 'completed' && (
          <div className="mb-6 bg-white text-black shadow-lg rounded-none border-2 border-black">
            <div className="text-center py-6 px-4">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-black" />
              <h2 className="text-2xl font-bold mb-2">Game Over!</h2>
              <p className="text-gray-700">The crossword puzzle has been completed.</p>
            </div>
          </div>
        )}

        {isHost && session?.status !== 'completed' && ( /* Host controls, not visible if game is completed */
          <div className="bg-white rounded-none shadow-lg p-4 md:p-6 mb-4 md:mb-6 border-2 border-black">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-black">Host Controls</h2>
                <p className="text-sm text-gray-700">End the session to view the final leaderboard</p>
              </div>
              <button
                onClick={handleEndSession}
                className="px-4 py-2 bg-black text-white rounded-none hover:bg-gray-800 transition-colors duration-200 border border-black"
              >
                End Session
              </button>
            </div>
          </div>
        )}

        {/* Mobile Navigation Tabs (for non-host) */}
        {!isHost && (
          <div className="flex rounded-none bg-white shadow-sm mb-4 md:hidden border-2 border-black">
            <button
              onClick={() => setMobileTab('grid')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-none ${
                mobileTab === 'grid'
                  ? 'bg-gray-100 text-black border-r border-black' // Highlight active tab
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setMobileTab('clues')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-none ${
                mobileTab === 'clues'
                  ? 'bg-gray-100 text-black border-l border-black' // Highlight active tab
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Clues
            </button>
          </div>
        )}

        {/* Main Content */}
        {isHost ? (
          // Host Layout - 3 columns
          <div className="flex flex-col lg:flex-row gap-6"> {/* Added flex-col for mobile stacking on host side */}
            <div className="w-full lg:w-1/4 bg-white rounded-none shadow-lg p-4 md:p-6 border-2 border-black h-[calc(100vh-12rem)] overflow-y-auto">
              {/* Clues for host */}
              <div className="space-y-6">
                {/* Across Clues */}
                <div>
                  <h3 className="text-lg font-semibold text-black mb-3">Across</h3>
                  <div className="space-y-2">
                    {placedWords
                      .filter(word => word.direction === 'horizontal')
                      .sort((a, b) => a.number - b.number)
                      .map(word => (
                        <div
                          key={`across-${word.number}`}
                          className="p-2 hover:bg-gray-50 rounded-none cursor-pointer transition-colors border-2 border-dashed border-gray-400"
                          onClick={() => handleClueClick(word)}
                        >
                          <span className="font-medium text-black">{word.number}.</span>
                          <span className="ml-2 text-gray-800">{word.question}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Down Clues */}
                <div>
                  <h3 className="text-lg font-semibold text-black mb-3">Down</h3>
                  <div className="space-y-2">
                    {placedWords
                      .filter(word => word.direction === 'vertical')
                      .sort((a, b) => a.number - b.number)
                      .map(word => (
                        <div
                          key={`down-${word.number}`}
                          className="p-2 hover:bg-gray-50 rounded-none cursor-pointer transition-colors border border-dashed border-gray-400"
                          onClick={() => handleClueClick(word)}
                        >
                          <span className="font-medium text-black">{word.number}.</span>
                          <span className="ml-2 text-gray-800">{word.question}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 w-full lg:w-auto bg-white rounded-none shadow-lg p-4 md:p-6 border-2 border-black"> {/* Added w-full */}
              {/* Grid for host */}
              <div className="w-full max-w-2xl mx-auto">
                <div className="mb-4 flex justify-between items-center">
                  <div>
                    <p className="text-gray-700 text-sm">
                      {completedWords.size} of {placedWords.length} words completed
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const emptyUserGrid = Array(grid.length).fill(null).map(() =>
                        Array(grid[0].length).fill('')
                      );
                      setUserGrid(emptyUserGrid);
                      setCompletedWords(new Set());
                      setShowHint(null);
                    }}
                    className="inline-flex items-center px-3 py-1.5 rounded-none border-2 border-black text-black hover:bg-gray-100 transition-colors duration-200 text-sm shadow-sm"
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Reset
                  </button>
                </div>
                <div className="grid gap-1 bg-gray-100 rounded-none border-2 border-black p-4">
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: `repeat(${grid[0]?.length || 15}, 1fr)`,
                    gap: '2px',
                    aspectRatio: '1',
                    width: '100%',
                    margin: '0 auto'
                  }}>
                    {grid.map((row, rowIndex) =>
                      row.map((cell, colIndex) => {
                        const isCompleted = cell.belongsToWords.every(num => completedWords.has(num));
                        const hasCompletedWord = cell.belongsToWords.some(num => completedWords.has(num));
                        return (
                          <div
                            key={`${rowIndex}-${colIndex}`}
                            onClick={() => !isCompleted && handleCellClick(rowIndex, colIndex)}
                            className={`
                              relative aspect-square border border-black text-center font-bold text-sm
                              ${cell.isBlack
                                ? 'bg-black'
                                : isCompleted // The completed word's cells
                                  ? 'bg-gray-200 border-gray-600 cursor-default'
                                  : hasCompletedWord
                                    ? 'bg-gray-100 border-gray-400 cursor-pointer hover:bg-gray-200 transition-colors duration-150'
                                    : 'bg-white cursor-pointer hover:bg-gray-100 transition-colors duration-150'
                              }
                              ${selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                                ? 'bg-gray-300 border-black'
                                : ''
                              }
                              flex items-center justify-center {/* IMPORTANT: Added flex to center content consistently */}
                            `}
                          >
                            {!cell.isBlack && (
                              <>
                                {cell.number && (
                                  <span className="absolute top-0 left-1 text-xs text-black font-semibold leading-none">
                                    {cell.number}
                                  </span>
                                )}
                                <div className="w-full h-full flex items-center justify-center text-lg font-bold text-black">
                                  {userGrid[rowIndex][colIndex]}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-1/4 bg-white rounded-none shadow-lg p-4 md:p-6 border-2 border-black h-[calc(100vh-12rem)] overflow-y-auto">
              {/* Progress for host */}
              <h2 className="text-xl font-semibold text-black mb-4">Player Progress</h2>
              <div className="space-y-3">
                {/* Group progress by player */}
                {Object.entries(
                  playerProgress.reduce((acc, progress) => {
                    if (!acc[progress.player_session_id]) {
                      acc[progress.player_session_id] = {
                        nickname: progress.nickname,
                        events: []
                      };
                    }
                    acc[progress.player_session_id].events.push(progress);
                    return acc;
                  }, {} as Record<string, { nickname: string; events: PlayerProgress[] }>)
                ).map(([playerId, data]) => (
                  <div key={playerId} className="bg-gray-50 rounded-none p-4 border-2 border-black shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-black">{data.nickname}</span>
                      <span className="text-sm text-gray-700">
                        {data.events.filter(e => e.event.startsWith('completed_word_')).length} words
                      </span>
                    </div>
                    <div className="space-y-1">
                      {data.events
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 5) // Show only last 5 events
                        .map(event => (
                          <div key={event.id} className="text-sm">
                            <span className="text-gray-800">{event.event.replace('completed_word_', 'Word ')}</span>
                            <span className="text-gray-500 text-xs ml-2">
                              {new Date(event.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
                {playerProgress.length === 0 && ( /* show message if no players have joined (excluding host) */
                  <p className="text-center text-gray-700 py-4">
                    No players have made progress yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Regular Player Layout - 2 columns on desktop, 1 column on mobile
          <div className="block md:flex md:gap-6">
            {/* Grid Section */}
            <div className={`
              w-full md:w-2/3
              bg-white rounded-none shadow-lg p-4 md:p-6 border border-black
              ${mobileTab === 'clues' ? 'hidden md:block' : ''}
            `}>
              <div className="max-w-3xl mx-auto">
                <div className="mb-4 flex justify-between items-center">
                  <div>
                    <p className="text-gray-700 text-sm">
                      {completedWords.size} of {placedWords.length} words completed
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const emptyUserGrid = Array(grid.length).fill(null).map(() =>
                        Array(grid[0].length).fill('')
                      );
                      setUserGrid(emptyUserGrid);
                      setCompletedWords(new Set());
                      setShowHint(null);
                    }}
                    className="inline-flex items-center px-3 py-1.5 rounded-none border border-black text-black hover:bg-gray-100 transition-colors duration-200 text-sm shadow-sm"
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Reset
                  </button>
                </div>
                <div className="grid gap-1 bg-gray-100 rounded-none border border-black p-4">
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${grid[0]?.length || 15}, 1fr)`,
                    gap: '2px',
                    aspectRatio: '1',
                    width: '100%',
                    margin: '0 auto'
                  }}>
                    {grid.map((row, rowIndex) =>
                      row.map((cell, colIndex) => {
                        // Use global completion status for cell background, as a player
                        const isCompletedGlobally = cell.belongsToWords.every(num => {
                            const wordCompletedByAnyPlayer = Object.values(playerProgress).some(
                                progressItem => progressItem.event === `completed_word_${num}`
                            );
                            return wordCompletedByAnyPlayer;
                        });

                        const hasCompletedWordGlobally = cell.belongsToWords.some(num => {
                            const wordCompletedByAnyPlayer = Object.values(playerProgress).some(
                                progressItem => progressItem.event === `completed_word_${num}`
                            );
                            return wordCompletedByAnyPlayer;
                        });

                        return (
                          <div
                            key={`${rowIndex}-${colIndex}`}
                            onClick={() => handleCellClick(rowIndex, colIndex)}
                            className={`
                              relative aspect-square border border-black text-center font-bold text-sm
                              ${cell.isBlack
                                ? 'bg-black'
                                : isCompletedGlobally
                                  ? 'bg-gray-200 border-gray-600 cursor-default'
                                  : hasCompletedWordGlobally
                                    ? 'bg-gray-100 border-gray-400 cursor-pointer hover:bg-gray-200 transition-colors duration-150'
                                    : 'bg-white cursor-pointer hover:bg-gray-100 transition-colors duration-150'
                              }
                              ${selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                                ? 'bg-gray-300 border-black'
                                : ''
                              }
                            `}
                          >
                            {!cell.isBlack && (
                              <>
                                {cell.number && (
                                  <span className="absolute top-0 left-0 text-[8px] md:text-xs text-black font-semibold leading-none">
                                    {cell.number}
                                  </span>
                                )}
                                <div className="w-full h-full flex items-center justify-center text-[10px] md:text-lg font-bold text-black">
                                  {userGrid[rowIndex][colIndex]}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Clues Section */}
            <div className={`
              w-full md:w-1/3
              bg-white rounded-none shadow-lg p-4 md:p-6
              mt-4 md:mt-0 border-2 border-black
              ${mobileTab === 'grid' ? 'hidden md:block' : ''}
              md:max-h-[calc(100vh-12rem)] md:overflow-y-auto
            `}>
              <div className="space-y-6">
                {/* Across Clues */}
                <div>
                  <h3 className="text-lg font-semibold text-black mb-3">Across</h3>
                  <div className="space-y-2">
                    {placedWords
                      .filter(word => word.direction === 'horizontal')
                      .sort((a, b) => a.number - b.number)
                      .map(word => (
                        <div
                          key={`across-${word.number}`}
                          className={`p-3 rounded-none border-2 border-black transition-all duration-200 ${
                            Object.values(playerProgress).some(p => p.event === `completed_word_${word.number}`) // Global check
                              ? 'bg-gray-200'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                          onClick={() => handleClueClick(word)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-black bg-gray-100 px-2 py-0.5 rounded-none border-2 border-black">
                                  {word.number}
                                </span>
                                {Object.values(playerProgress).some(p => p.event === `completed_word_${word.number}`) && ( // Global check
                                  <CheckCircle className="h-4 w-4 text-black" />
                                )}
                                {playerProgress.find(p => p.event === `completed_word_${word.number}` && p.nickname) && ( // Display first solver if available
                                    <span className="text-black text-xs font-semibold ml-2 border border-black px-1 py-0.5 rounded-none">
                                      🥇 {playerProgress.find(p => p.event === `completed_word_${word.number}`)?.nickname}
                                    </span>
                                )}
                              </div>
                              <p className="text-sm text-black">{word.question}</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleHint(word.number);
                              }}
                              className="p-1.5 text-black hover:text-gray-700 hover:bg-gray-100 rounded-none transition-colors duration-200"
                            >
                              <Lightbulb className="h-4 w-4" />
                            </button>
                          </div>
                          {showHint === word.number && (
                            <div className="mt-2 p-2 bg-gray-100 border-2 border-black rounded-none text-xs">
                              <strong>Hint:</strong> {word.word}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Down Clues */}
                <div>
                  <h3 className="text-lg font-semibold text-black mb-3">Down</h3>
                  <div className="space-y-2">
                    {placedWords
                      .filter(word => word.direction === 'vertical')
                      .sort((a, b) => a.number - b.number)
                      .map(word => (
                        <div
                          key={`down-${word.number}`}
                          className={`p-3 rounded-none border-2 border-black transition-all duration-200 ${
                            Object.values(playerProgress).some(p => p.event === `completed_word_${word.number}`) // Global check
                              ? 'bg-gray-200'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                          onClick={() => handleClueClick(word)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-black bg-gray-100 px-2 py-0.5 rounded-none border-2 border-black">
                                  {word.number}
                                </span>
                                {Object.values(playerProgress).some(p => p.event === `completed_word_${word.number}`) && ( // Global check
                                  <CheckCircle className="h-4 w-4 text-black" />
                                )}
                                {playerProgress.find(p => p.event === `completed_word_${word.number}` && p.nickname) && ( // Display first solver if available
                                    <span className="text-black text-xs font-semibold ml-2 border border-black px-1 py-0.5 rounded-none">
                                      🥇 {playerProgress.find(p => p.event === `completed_word_${word.number}`)?.nickname}
                                    </span>
                                )}
                              </div>
                              <p className="text-sm text-black">{word.question}</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleHint(word.number);
                              }}
                              className="p-1.5 text-black hover:text-gray-700 hover:bg-gray-100 rounded-none transition-colors duration-200"
                            >
                              <Lightbulb className="h-4 w-4" />
                            </button>
                          </div>
                          {showHint === word.number && (
                            <div className="mt-2 p-2 bg-gray-100 border-2 border-black rounded-none text-xs">
                              <strong>Hint:</strong> {word.word}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Input Modal */}
      {showInputModal && selectedCell && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-t-none lg:rounded-none p-6 mx-4 lg:mx-auto border-t-2 border-l-2 border-r-2 border-black lg:border shadow-lg">
            {selectedCell.words.length > 1 && !selectedDirection ? (
              <>
                <h3 className="text-lg font-semibold text-black mb-4">Choose Direction</h3>
                <div className="space-y-3">
                  {selectedCell.words.map((word) => (
                    <button
                      key={word.direction}
                      onClick={() => {
                        selectDirection(word.direction);
                        setModalInputs(Array(word.word.length).fill(''));
                      }}
                      className="w-full p-4 text-left rounded-none border-2 border-black hover:bg-gray-100 transition-colors shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-black bg-gray-100 px-2 py-1 rounded-none border-2 border-black">
                          {word.number} {word.direction === 'horizontal' ? 'Across' : 'Down'}
                        </span>
                      </div>
                      <p className="text-sm text-black">{word.question}</p>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setShowInputModal(false);
                    setSelectedCell(null);
                    setSelectedDirection('horizontal');
                  }}
                  className="mt-6 w-full py-2 border-2 border-black text-black hover:bg-gray-100 rounded-none shadow-sm"
                >
                  Cancel
                </button>
              </>
            ) : selectedDirection ? (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-black">
                      {selectedDirection === 'horizontal' ? 'Across' : 'Down'} {selectedCell.words.find(w => w.direction === selectedDirection)?.number}
                    </h3>
                    <p className="text-sm text-gray-700 mt-1">
                      {selectedCell.words.find(w => w.direction === selectedDirection)?.question}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowInputModal(false);
                      setSelectedCell(null);
                      setSelectedDirection('horizontal');
                    }}
                    className="text-black hover:text-gray-700 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="flex flex-wrap justify-center gap-2 my-6">
                  {modalInputs.map((input, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        modalInputRefs.current[index] = el;
                        return undefined;
                      }}
                      type="text"
                      maxLength={1}
                      value={input}
                      onChange={(e) => handleModalInput(index, e.target.value)}
                      className="w-10 h-10 text-center text-xl font-bold border-2 border-black rounded-none focus:border-black focus:ring-0 text-black uppercase"
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-none shadow-lg max-w-md w-full border-2 border-black">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-black">Share Board</h2>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-black hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="bg-gray-100 p-6 rounded-none border-2 border-black flex items-center justify-center mb-6"> {/* Changed bg-gray-50 to bg-gray-100 */}
              <QRCodeSVG
                value={boardUrl}
                size={Math.min(200, window.innerWidth - 80)}
                level="H"
                includeMargin
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Board URL
              </label>
              <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-none border-2 border-black"> {/* Changed bg-gray-50 to bg-gray-100 */}
                <input
                  type="text"
                  readOnly
                  value={boardUrl}
                  className="flex-1 bg-transparent border-none text-black focus:outline-none text-sm"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(boardUrl);
                    toast.success('Game link copied to clipboard');
                  }}
                  className="text-black hover:text-gray-700 transition-colors p-1"
                >
                  <LinkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}