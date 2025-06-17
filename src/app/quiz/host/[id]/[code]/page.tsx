'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Home, Share, Users, Play, Timer, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { motion, AnimatePresence } from 'framer-motion';

interface Question {
  id: string;
  question_text: string;
  image_url?: string;
  time_limit: number;
  quiz_question_options: {
    id: string;
    option_text: string;
    is_correct: boolean;
  }[];
}

interface QuizParticipant {
  id: string;
  session_id: string;
  player_session_id: string;
  nickname: string;
  score: number;
}

const dummyQuestions: Question[] = [
  {
    id: '1',
    question_text: 'What is the capital of France?',
    time_limit: 30,
    quiz_question_options: [
      { id: '1a', option_text: 'London', is_correct: false },
      { id: '1b', option_text: 'Paris', is_correct: true },
      { id: '1c', option_text: 'Berlin', is_correct: false },
      { id: '1d', option_text: 'Madrid', is_correct: false },
    ],
  },
  {
    id: '2',
    question_text: "Which planet is known as the Red Planet? Lorem ipsum dolor sit amet consectetur adipisicing elit. michelle alexandra sweet sweet michelle i love michelle cant",
    image_url: 'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=800&auto=format&fit=crop&q=60',
    time_limit: 20,
    quiz_question_options: [
      { id: '2a', option_text: 'Supercalifragilisticespialadocious', is_correct: false },
      { id: '2b', option_text: 'Mars', is_correct: true },
      { id: '2c', option_text: 'Jupiter', is_correct: false },
      { id: '2d', option_text: 'Saturn', is_correct: false },
    ],
  },
];

export default function QuizHostPage({ params }: { params: { id: string; code: string } }) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [playerSession, setPlayerSession] = useState<any>(null);
  const [playerProgress, setPlayerProgress] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [players, setPlayers] = useState<any[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [showCountdownModal, setShowCountdownModal] = useState(true);
  const [countdown, setCountdown] = useState(3);
  const [showQuestion, setShowQuestion] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [questionPopped, setQuestionPopped] = useState(false);

  const currentQuestion: Question = quizQuestions[currentQuestionIndex] || dummyQuestions[0];

  // Countdown modal logic
  useEffect(() => {
    if (!showCountdownModal) return;
    setCountdown(3);
    setShowQuestion(false);
    setQuestionPopped(false);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(interval);
          setShowCountdownModal(false);
          setTimeout(() => {
            setShowQuestion(true);
            setTimeout(() => setQuestionPopped(true), 100); // pop animation after question appears
          }, 100);
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showCountdownModal, currentQuestionIndex]);

  // Start timeLeft countdown after question is shown
  useEffect(() => {
    if (!showQuestion) return;
    const limit = currentQuestion.time_limit || 10;
    setTimeLeft(limit);
    if (!questionPopped) return;
    if (limit <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showQuestion, questionPopped, currentQuestionIndex, currentQuestion.time_limit]);

  // When next question is pressed, reset modal and question state
  const handleNextQuestion = () => {
    setShowCountdownModal(true);
    setShowQuestion(false);
    setQuestionPopped(false);
    setCurrentQuestionIndex((prev) => prev + 1);
  };

  useEffect(() => {
    console.log('quizQuestions validating');
    const validateSession = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          console.log('authError', authError);
          // router.replace('/');
          return;
        }

        // Check both host and player storage
        const hostStoredSession = localStorage.getItem(`host_${params.code}`);
        const playerStoredSession = localStorage.getItem(`player_${params.code}`);

        if (!hostStoredSession && !playerStoredSession) {
          console.log('no stored session');
          // router.replace('/');
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
          console.log('sessionError', sessionError);
          // router.replace('/');
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
          console.log('playerError', playerError);
          // router.replace('/');
          return;
        }

        setPlayerSession(playerSessionData);

        const { data: quizQuestionData, error: quizQuestionError } = await supabase
            .from('quiz_questions')
            .select(`
            *,
            quiz_question_options (*)
            `)
            .eq('quiz_id', params.id)
            .order('order_index', { ascending: true });

        if (quizQuestionError) throw quizQuestionError;

        setQuizQuestions(quizQuestionData);

        setIsLoading(false);
      } catch (error) {
        console.error('Error validating session:', error);
        // router.replace('/');
      }
    };
    validateSession();
  }, [params.id, params.code, router, supabase]);

  // Setup channels only when session is available
  useEffect(() => {
    if (!session) return;

    const playersChannel = supabase.channel(`quiz_players:${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_participants',
          filter: `session_id=eq.${session.id}`
        },
        (payload) => {
          console.log('Received player update:', payload);
          if (payload.eventType === 'INSERT') {
            setPlayers(current => [...current, payload.new as QuizParticipant]);
            toast.success(`${payload.new.nickname} joined the game`);
          } else if (payload.eventType === 'UPDATE') {
            setPlayers(current =>
              current.map(p => p.id === payload.new.id ? payload.new as QuizParticipant : p)
            );
          } else if (payload.eventType === 'DELETE') {
            setPlayers(current =>
              current.filter(p => p.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    const quizSessionChannel = supabase.channel(`quiz_session:${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_sessions',
          filter: `code=eq.${params.code}`
        },
        (payload) => {
          console.log('Received quiz session update:', payload);
          if (payload.eventType === 'UPDATE') {
            setCurrentQuestionIndex(payload.new.current_question_index);
          } 
        }
      )
      .subscribe();

    return () => {
      playersChannel.unsubscribe();
      quizSessionChannel.unsubscribe();
    };
  }, [session, params.code, supabase]);

  return (
    <div className="h-screen bg-white bg-[url('/Background.svg')] bg-repeat p-4 md:p-8 flex flex-col items-center justify-center">
      <AnimatePresence>
        {showCountdownModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl shadow-2xl p-12 border-4 border-black text-6xl font-extrabold text-black"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              {countdown}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="w-full max-w-4xl mx-auto h-full flex flex-col">
        <div className="bg-white rounded-xl shadow-lg border-2 border-black flex-1 flex flex-col overflow-hidden">
          {/* Browser Chrome Bar */}
          <div className="flex items-center px-4 py-2 bg-gray-100 rounded-t-xl border-b-2 border-black">
            {/* Circles */}
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-red-500 border-2 border-black"></span>
              <span className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-black"></span>
              <span className="w-4 h-4 rounded-full bg-green-500 border-2 border-black"></span>
            </div>
            {/* Fake address bar */}
            <div className="flex-1 flex justify-center">
              <div className="px-4 py-1 bg-white border border-gray-300 rounded-full text-xs text-gray-500">
                hayolo.io/quiz
              </div>
            </div>
            {/* Spacer for symmetry */}
            <div className="w-16"></div>
          </div>
          {/* Main Card Content */}
          <div className="flex-1 flex flex-col p-4 md:p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg text-gray-700">
                Question {currentQuestionIndex + 1} of {quizQuestions.length}
              </span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
                  <Timer className="h-5 w-5 text-black" />
                  <span className="font-bold text-black">{timeLeft}s</span>
                </div>
                {/* Next Question button only shows when timeLeft is 0 */}
                {timeLeft === 0 && (
                  <button
                    onClick={handleNextQuestion}
                    className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Next Question
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 flex flex-col items-center justify-center min-h-0">
                <AnimatePresence>
                  {showQuestion && (
                    <motion.h2
                      className="text-3xl font-bold text-black mb-6 text-center px-4"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={questionPopped ? { scale: 1.1, opacity: 1 } : { scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      {currentQuestion.question_text}
                    </motion.h2>
                  )}
                </AnimatePresence>
                {currentQuestion.image_url && showQuestion && (
                  <div className="flex-1 w-full flex items-center justify-center min-h-0 max-h-[50vh]">
                    <img
                      src={currentQuestion.image_url}
                      alt="Question"
                      className="max-w-full max-h-full object-contain rounded-lg"
                    />
                  </div>
                )}
              </div>
              {/* Answer Options */}
              {showQuestion && (
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {currentQuestion.quiz_question_options.map((option, idx) => (
                    <motion.div
                      key={option.id}
                      className={`relative p-6 rounded-xl border-2 shadow-lg text-center ${
                        option.is_correct && timeLeft === 0 ? 'border-green-500 bg-green-50' : 'border-gray-700'
                      }`}
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={questionPopped ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <div className="absolute top-[-10px] left-[-10px] bg-[#FFD34E] border-2 border-black rounded-lg w-10 h-10 flex items-center justify-center text-2xl font-bold text-black">
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <span className="font-medium text-black text-2xl">{option.option_text}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
