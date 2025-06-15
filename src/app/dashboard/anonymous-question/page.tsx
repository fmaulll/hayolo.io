// app/dashboard/anonymous-question/page.tsx
'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Edit, Eye, MessageSquare, X, Play, Square } from 'lucide-react'; // Added Lucide icons for consistency
import toast from 'react-hot-toast';
import ModalLoading from '@/app/components/ModalLoading';
import ConfirmationModal from '@/components/ConfirmationModal';

interface Board {
  id: string;
  title: string;
  created_at: string;
  user_id: string;
  description: string | null;
  session_status: 'waiting' | 'in_progress' | 'completed' | null;
  session_id: string | null;
  session_code: string | null;
  questions: {
    count: number;
  }[];
}

export default function AnonymousQuestion() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  
  const fetchBoards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: boardsData, error } = await supabase
        .from('boards')
        .select(`
          *,
          questions:questions(count)
        `)
        .eq('user_id', user.id)
        .eq('questions.spam', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const boardIds = boardsData.map(b => b.id);

      let sessionsMap: Map<string, { id: string, status: 'waiting' | 'in_progress' | 'completed', code: string }> = new Map();

      if (boardIds.length > 0) {
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('present_sessions')
          .select('id, content_id, status, code')
          .in('content_id', boardIds)
          .or('status.eq.waiting,status.eq.in_progress');

        if (sessionsError) console.error("Error fetching sessions:", sessionsError);

        if (sessionsData) {
          sessionsData.forEach(session => {
            const existingSession = sessionsMap.get(session.content_id);
            if (!existingSession || (existingSession.status === 'waiting' && session.status === 'in_progress')) {
              sessionsMap.set(session.content_id, {
                id: session.id,
                status: session.status,
                code: session.code
              });
            }
          });
        }
      }

      const finalBoards = boardsData.map(board => {
        const activeSession = sessionsMap.get(board.id);
        return {
          ...board,
          session_status: activeSession ? activeSession.status : null,
          session_id: activeSession ? activeSession.id : null,
          session_code: activeSession ? activeSession.code : null,
        };
      });

      console.log(finalBoards);
      setBoards(finalBoards || []);
    } catch (error) {
      console.error('Error fetching boards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, [router, supabase]);

  const handleCreateBoard = async () => {
    const trimmedName = newBoardName?.trim() || '';
    if (!trimmedName) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      if (editingId) {
        // Update existing board
        const { error } = await supabase
          .from('boards')
          .update({
            title: trimmedName,
            description: newBoardDescription?.trim() || null,
          })
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Update local state
        setBoards(current =>
          current.map(board => board.id === editingId ? {
            ...board,
            title: trimmedName,
            description: newBoardDescription?.trim() || null,
          } : board)
        );

        // Reset editing state
        setEditingId(null);
      } else {
        // Create new board
        const { data, error } = await supabase
          .from('boards')
          .insert([
            {
              title: trimmedName,
              description: newBoardDescription?.trim() || null,
              user_id: user.id
            }
          ])
          .select()
          .single();

        if (error) throw error;

        // Add the new board to the list
        setBoards(current => [{ ...data, questions: [{ count: 0 }] }, ...current]);
      }

      // Reset form and close modal
      setNewBoardName('');
      setNewBoardDescription('');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating/updating board:', error);
      setError('Failed to save board. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setPendingDeleteId(id);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setIsDeleting(true);
    setDeletingId(pendingDeleteId);
    setShowDeleteModal(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { error } = await supabase
        .from('boards')
        .delete()
        .eq('id', pendingDeleteId)
        .eq('user_id', user.id);
      if (error) throw error;
      setBoards(current => current.filter(board => board.id !== pendingDeleteId));
    } catch (error) {
      console.error('Error deleting board:', error);
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  };

  const handleEditBoard = (board: Board) => {
    setNewBoardName(board.title || '');
    setNewBoardDescription(board.description || '');
    setShowCreateModal(true);
    setEditingId(board.id);
  };

  const handlePresentBoard = async (board: Board) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: newSessionCode, error: joinError } = await supabase
        .rpc('join_question_session', {
          p_content_id: board.id,
          p_user_id: user.id,
          p_session_type: 'question'
        });

      if (joinError) throw joinError;

      router.push(`/questions/${board.id}/${newSessionCode}`);
    } catch (error) {
      console.error('Error joining present session:', error);
    }
  }


  const handleStopSession = async (board: Board) => {
    if (!board.session_id) return;
    try {
      const { data, error } = await supabase
        .from('present_sessions')
        .update({ status: 'completed' })
        .eq('id', board.session_id)
        .select();

      if (error) throw error;

      if (data) {
        toast.success(`Session for ${board.title} stopped`);
        fetchBoards();
      }
    } catch (error) {
      console.error('Error stopping session:', error);
      alert('Failed to stop the session. Please try again.');
    } finally {
      // setIsStopping(false);
      // setStoppingId(null);
    }
  }

  return (
    <>
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Board"
        message="Are you sure you want to delete this board? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
      {/* Anonymous Q&A Title */}
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-4xl font-extrabold text-black mb-2">Anonymous Q&A</h1>
        <p className="text-gray-700 text-xl mb-4">Create and manage your anonymous Q&A boards</p>
      </div>

      {/* Q&A Boards Section */}
      <div className="bg-white rounded-lg shadow p-6 border-2 border-black mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-black">My Q&A Boards</h2>
            <p className="text-sm text-gray-500 mt-1">Showing {boards.length} boards</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-full border-2 border-black text-black bg-[#FFD34E] hover:bg-yellow-300 transition-all duration-200 flex items-center justify-center font-bold"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center min-h-[200px]">
            <div className="animate-spin rounded-none h-8 w-8 border-2 border-black"></div>
          </div>
        ) : boards.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-none border-2 border-dashed border-black shadow-lg">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-none bg-gray-100 mb-4 border-2 border-black">
              <MessageSquare className="w-8 h-8 text-black" />
            </div>
            <h3 className="text-lg font-semibold text-black mb-2">No Q&A Boards Yet</h3>
            <p className="text-gray-700 mb-6">Create your first Q&A board to start collecting anonymous questions!</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white hover:bg-gray-800 transition-all shadow-md rounded-lg"
            >
              <Plus className="w-5 h-5" />
              Create Your First Board
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {boards.map((board) => (
              <div
                key={board.id}
                className="group relative bg-white rounded-lg border-dashed border-black shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border-2"
              >
                <div className="absolute top-0 right-0 mt-4 mr-4 z-10">
                  <button
                    onClick={() => handleDeleteClick(board.id)}
                    disabled={isDeleting && deletingId === board.id}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-none border-2 border-black text-black hover:bg-gray-100 transition-all disabled:opacity-50"
                  >
                    {isDeleting && deletingId === board.id ? (
                      <svg className="animate-spin h-4 w-4 text-black" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-black transition-colors line-clamp-1 flex items-center">
                    {board.title}
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-none text-xs font-medium bg-gray-100 text-black border border-black">
                      {board.questions[0]?.count || 0} questions
                    </span>
                  </h3>
                  {board.description && (
                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">{board.description}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-2">
                    Created {new Date(board.created_at).toLocaleDateString()}
                  </p>

                  <div className="mt-6 flex items-center gap-3">
                    {board.session_status === 'in_progress' ? (
                      <button
                        onClick={() => handleStopSession(board)}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full !p-0 flex-none
                                 bg-black text-white hover:bg-gray-800 transition-colors shadow-sm"
                      >
                        <Square className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePresentBoard(board)}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full !p-0 flex-none
                                 bg-black text-white hover:bg-gray-800 transition-colors shadow-sm"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <Link
                      href={`/dashboard/anonymous-question/${board.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-black text-sm font-medium rounded-lg hover:bg-gray-50 transition-all text-black"
                    >
                      <Eye className="w-4 h-4" />
                      Details
                    </Link>
                    <button
                      onClick={() => handleEditBoard(board)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-black text-sm font-medium rounded-lg hover:bg-gray-50 transition-all text-black"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Board Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-black max-w-md w-full p-8 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-black">{editingId ? 'Edit Q&A Board' : 'Create Q&A Board'}</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingId(null);
                  setNewBoardName('');
                  setNewBoardDescription('');
                }}
                className="text-black hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="boardName" className="block text-sm font-medium text-black mb-1">
                  Board Name
                </label>
                <input
                  type="text"
                  id="boardName"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border-2 border-black text-black focus:outline-none focus:ring-1 focus:ring-black transition-all"
                  placeholder="Enter board name"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label htmlFor="boardDescription" className="block text-sm font-medium text-black mb-1">
                  Description (Optional)
                </label>
                <textarea
                  id="boardDescription"
                  value={newBoardDescription}
                  onChange={(e) => setNewBoardDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border-2 border-black text-black focus:outline-none focus:ring-1 focus:ring-black transition-all"
                  placeholder="Enter board description"
                  disabled={isSubmitting}
                />
              </div>
              {error && (
                <div className="text-sm text-red-600 text-center border border-red-600 p-2 rounded-lg mt-4">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-4 pt-2">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingId(null);
                    setNewBoardName('');
                    setNewBoardDescription('');
                  }}
                  className="px-6 py-2 rounded-full font-bold text-black bg-white border-2 border-black hover:bg-gray-100 shadow transition-all"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBoard}
                  disabled={isSubmitting || !(newBoardName?.trim())}
                  className="px-6 py-2 rounded-full font-bold text-black bg-[#FFD34E] hover:bg-yellow-300 border-2 border-black shadow transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-black" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {editingId ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      {editingId ? 'Update Board' : 'Create Board'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* <ModalLoading isOpen={isLoading} /> */}
    </>
  );
}