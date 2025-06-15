// app/dashboard/anonymous-question/page.tsx
'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Plus, Trash2, Edit, Eye, MessageSquare, X, Link as LinkIcon, User, Clock, Star } from 'lucide-react'; // Added Lucide icons for consistency
import QuestionCard from '../components/QuestionCard'; // Assuming this component is styled separately
import NamePromptModal from '../components/NamePromptModal'; // Assuming this component is styled separately
import { toast } from 'react-hot-toast'; // Assuming toast is installed
import { QRCodeSVG } from 'qrcode.react';

interface Board {
  id: string;
  title: string;
  description: string;
  user_id: string;
  code: string;
}

interface Question { // Re-defined based on context, full definition not provided
  id: string;
  question: string;
  board_id: string;
  order: number;
  questioned_by: string | null;
  spam: boolean;
  likes_count?: number; // Optional, as it might be joined/counted
  comments_count?: number; // Optional, as it might be joined/counted
  created_at: string; // Crucial for sorting
  question_number?: number; // Dynamically added
}

interface QuestionWithComments extends Question {
  comments: { count: number }[];
}

type SortOrder = 'newest' | 'oldest' | 'popular';

export default function QuestionsPage({ params }: { params: { id: string, code: string } }) { // params only contains 'id' here, 'code' isn't part of it in this context
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestionIds, setNewQuestionIds] = useState<Set<string>>(new Set());
  const [board, setBoard] = useState<Board | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [userName, setUserName] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  // The 'code' should come from the 'board' data itself, not params, if params.id is board ID
  const boardUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/questions/${params.id}/${params.code}` // Use board.id for the URL
    : '';

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);

      if (!session) {
        const storedName = localStorage.getItem('questionboard_user_name');
        if (!storedName) {
          setShowNamePrompt(true);
        } else {
          setUserName(storedName);
        }
      }
    };

    checkAuth();
  }, [supabase.auth]);

  const handleNameSubmit = (name: string) => {
    const finalName = name || null;
    setUserName(finalName);
    if (finalName) {
      localStorage.setItem('questionboard_user_name', finalName);
    } else {
      localStorage.removeItem('questionboard_user_name');
    }
    setShowNamePrompt(false);
  };

  const handleUpdateName = () => {
    setShowNamePrompt(true);
  };

  const fetchBoardAndQuestions = async () => {
    try {
      const { data: boardData, error: boardError } = await supabase
        .from('boards')
        .select('*')
        .eq('id', params.id)
        .single();

      if (boardError) throw boardError;
      setBoard(boardData);

      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*, comments(count)')
        .eq('board_id', params.id)
        .eq('spam', false)
        .order(sortOrder === 'popular' ? 'likes_count' : 'created_at', {
          ascending: sortOrder === 'oldest',
          nullsFirst: sortOrder === 'popular' ? false : undefined
        });

      if (questionsError) throw questionsError;

      const questionsWithCount = questionsData?.map((question: QuestionWithComments, index: number) => ({
        ...question,
        question_number: sortOrder === 'oldest' ? index + 1 : questionsData.length - index
      })) || [];

      setQuestions(questionsWithCount);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBoardAndQuestions();
  }, [sortOrder, params.id]);

  useEffect(() => {
    const channel = supabase.channel(`questions_for_board_${params.id}`);

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'questions',
          filter: `board_id=eq.${params.id}`
        },
        (payload) => {
          if (!(payload.new as Question).spam) {
            const payloadId = (payload.new as Question).id;

            setQuestions(current => {
              const newQuestionIndex = current.findIndex(q => q.id === payloadId);

              if (newQuestionIndex !== -1) {
                const newQuestions = [...current];
                newQuestions[newQuestionIndex] = {
                  ...payload.new as Question,
                  likes_count: (payload.new as Question).likes_count,
                  comments_count: (payload.new as Question).comments_count,
                  question_number: questions.length
                };
                return sortQuestions(newQuestions, sortOrder);
              } else {
                const newQuestion = {
                  ...payload.new as Question,
                  comments_count: 0,
                  question_number: current.length + 1
                };
                const newQuestions = [...current, newQuestion];
                return sortQuestions(newQuestions, sortOrder);
              }
            });

            if (payload.eventType === 'INSERT') {
              setNewQuestionIds(new Set([payloadId]));
              setTimeout(() => setNewQuestionIds(new Set()), 1000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [params.id, questions, sortOrder, supabase]);

  const sortQuestions = (questions: Question[], order: SortOrder) => {
    return [...questions].sort((a, b) => {
      if (order === 'popular') {
        return (b.likes_count || 0) - (a.likes_count || 0);
      }
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return order === 'oldest' ? dateA - dateB : dateB - dateA;
    });
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const isSpam = false;

      const { data, error } = await supabase
        .from('questions')
        .insert([
          {
            question: newQuestion.trim(),
            board_id: params.id,
            order: questions.length,
            questioned_by: userName,
            spam: isSpam
          }
        ])
        .select()
        .single();

      if (error) throw error;

      if (data && !isSpam) {
        setQuestions(current => sortQuestions([...current, data], sortOrder));
        setNewQuestionIds(new Set([data.id]));
        setTimeout(() => setNewQuestionIds(new Set()), 1000);
      }

      setNewQuestion('');
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding question:', error);
      setError('Failed to add question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-none h-12 w-12 border-2 border-black mx-auto"></div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-black text-xl">Board not found</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b-2 border-black shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link
              href="/dashboard"
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
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-8">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-black mb-2">{board.title}</h1>
                <p className="text-gray-700">{board.description}</p>
                {/* Display the Board Code here */}
                {/* Assuming `board` object has a 'code' property for the join code.
                    If not, you'd need to fetch or generate it and store it in the `boards` table. */}
                {board.id && ( // Using board.id as the "code" for display if no separate code column
                    <p className="text-gray-700 mt-1">
                        Board Code: <span className="font-extrabold text-black text-xl md:text-2xl">{board.code}</span>
                    </p>
                )}
              </div>

              {/* Reordered buttons and "Participating as" section for mobile */}
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                {/* "Participating as" section - now always first in vertical order for mobile */}
                {!isAuthenticated && (
                  <div className="order-1 sm:order-none p-4 border-2 border-black border-dashed rounded-none flex flex-col sm:flex-row items-center gap-2 text-sm bg-gray-50 shadow-sm w-full">
                    <span className="text-gray-700">Participating as:</span>
                    <button
                      onClick={handleUpdateName}
                      className="text-black hover:text-gray-800 transition-colors flex items-center gap-2 group border border-transparent hover:border-black rounded-none p-1 -m-1"
                    >
                      <User className="w-5 h-5 text-black group-hover:text-gray-800 transition-colors" />
                      <span className="font-medium">{userName || 'Anonymous'}</span>
                      <Edit className="w-4 h-4 text-black group-hover:text-gray-800 transition-colors" />
                    </button>
                  </div>
                )}
                {/* Buttons - now second in vertical order for mobile */}
                <div className={clsx(
                  "order-2 sm:order-none flex flex-col sm:flex-row gap-2 w-full",
                  !isAuthenticated ? 'mt-0' : 'mt-0'
                )}>
                    {!isAuthenticated && <button
                      onClick={() => setShowAddModal(true)}
                      className="inline-flex justify-center items-center gap-2 bg-black text-white px-4 py-2 rounded-none font-medium hover:bg-gray-800 transition-all shadow-md border border-black w-full"
                    >
                      <Plus className="w-5 h-5" />
                      Question
                    </button>}
                    <button
                      onClick={() => {
                        const nextOrder: Record<SortOrder, SortOrder> = {
                          newest: 'oldest',
                          oldest: 'popular',
                          popular: 'newest'
                        };
                        setSortOrder(nextOrder[sortOrder]);
                      }}
                      className="inline-flex justify-center items-center gap-2 bg-white text-black px-4 py-2 rounded-none font-medium hover:bg-gray-100 transition-all shadow-md border-2 border-black w-full"
                    >
                      {sortOrder === 'popular' ? <Star className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      {sortOrder === 'newest' ? 'Newest' : sortOrder === 'oldest' ? 'Oldest' : 'Popular'}
                    </button>
                </div>
              </div>
            </div>
            
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {questions.map((question) => (
              <div
                key={question.id}
                className={clsx(
                  'transition-all duration-300',
                  newQuestionIds.has(question.id) && 'animate-[pop-in_0.3s_ease-out]'
                )}
              >
                <QuestionCard
                  question={question}
                  index={question.order}
                  userName={userName || 'Anonymous'}
                  isAuthenticated={isAuthenticated}
                  sortOrder={sortOrder}
                />
              </div>
            ))}
          </div>

          {questions.length === 0 && (
            <div className="text-center py-12 bg-white rounded-none border-2 border-black shadow-lg">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-none bg-gray-100 mb-4 border border-black">
                <MessageSquare className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-lg font-semibold text-black mb-2">No questions yet</h3>
              <p className="text-gray-700 mb-6">Start by adding your first question</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-none font-medium hover:bg-gray-800 transition-all shadow-md border border-black"
              >
                <Plus className="w-5 h-5" />
                Add Your First Question
              </button>
            </div>
          )}
        </div>

        {/* QR Code Modal */}
        {showQRModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-none shadow-xl max-w-md w-full border-2 border-black">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-black">Share Board</h2>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="text-black hover:text-gray-700 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="bg-gray-100 p-6 rounded-none border-2 border-black flex items-center justify-center mb-6">
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
                <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-none border-2 border-black">
                  <input
                    type="text"
                    readOnly
                    value={boardUrl}
                    className="flex-1 bg-transparent border-none text-black focus:outline-none text-sm"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(boardUrl);
                      toast.success('Link copied to clipboard');
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

        {/* Add Question Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-none shadow-xl max-w-md w-full border-2 border-black">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-black">Add Question</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-black hover:text-gray-700 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="question" className="block text-sm font-medium text-black mb-1">
                    Question
                  </label>
                  <textarea
                    id="question"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-white border-2 border-black rounded-none text-black focus:outline-none focus:ring-0 focus:border-black transition-all"
                    placeholder="Enter your question"
                    disabled={isSubmitting}
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-600 text-center border border-red-600 p-2 rounded-none mt-4">
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-black hover:text-gray-700 transition-colors rounded-none border-2 border-transparent hover:border-black"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddQuestion}
                    disabled={isSubmitting || !(newQuestion?.trim())}
                    className="bg-black text-white px-4 py-2 rounded-none hover:bg-gray-800 transition-all shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-black"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </>
                    ) : (
                      'Add Question'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Name Prompt Modal */}
        {showNamePrompt && (
          <NamePromptModal
            onClose={() => setShowNamePrompt(false)}
            onSubmit={handleNameSubmit}
            defaultName={userName || ''}
          />
        )}
      </div>
    </main>
  );
}