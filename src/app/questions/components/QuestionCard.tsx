// components/QuestionCard.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, User, MessageSquare, Heart, Clock, PencilLine, X } from 'lucide-react'; // Added Lucide icons for consistency
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { memo, useState, useEffect } from 'react';
import CommentSection from './CommentSection'; // Assuming this component is styled separately
import { supabase } from '@/utils/supabase'; // Assuming supabase client is imported directly here
import { getBrowserFingerprint } from '@/utils/fingerprint'; // Assuming fingerprint utility

interface Question {
  id: string;
  question: string;
  board_id: string;
  order: number;
  questioned_by: string | null;
  spam: boolean;
  likes_count?: number;
  comments_count?: number;
  created_at: string;
  question_number?: number;
}

interface QuestionCardProps {
  question: Question;
  index: number;
  isOverlay?: boolean;
  userName: string;
  isAuthenticated: boolean;
  sortOrder: 'newest' | 'oldest' | 'popular';
}

function QuestionCard({ question, isOverlay = false, userName, isAuthenticated, sortOrder }: QuestionCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false); // State for comments section visibility
  const [localLikes, setLocalLikes] = useState(question.likes_count || 0);
  const [isLiked, setIsLiked] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: question.id,
    data: {
      type: 'Question',
      question,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const timeAgo = formatDistanceToNow(new Date(question.created_at), { addSuffix: true });

  // Check if the current browser has liked this question
  useEffect(() => {
    const checkLikeStatus = async () => {
      try {
        const fingerprint = await getBrowserFingerprint();
        const { data, error } = await supabase
          .from('likes')
          .select('id')
          .eq('question_id', question.id)
          .eq('fingerprint', fingerprint)
          .maybeSingle();

        if (error) throw error;
        setIsLiked(!!data);
      } catch (error) {
        console.error('Error checking like status:', error);
      }
    };

    checkLikeStatus();
  }, [question.id]); // Dependency on question.id

  // Update localLikes when question prop changes (e.g., from realtime updates)
  useEffect(() => {
    setLocalLikes(question.likes_count || 0);
  }, [question.likes_count]);

  const handleLikeClick = async () => {
    try {
      const fingerprint = await getBrowserFingerprint();
      const { data: { user } } = await supabase.auth.getUser(); // Get current user

      // Optimistically update UI
      const newLikes = isLiked ? localLikes - 1 : localLikes + 1;
      setLocalLikes(newLikes);
      setIsLiked(!isLiked);

      if (isLiked) {
        // Unlike: Delete the like record
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('question_id', question.id)
          .eq('fingerprint', fingerprint);

        if (error) {
          // Revert on error
          setLocalLikes(localLikes);
          setIsLiked(isLiked);
          throw error;
        }
      } else {
        // Like: Insert new like record
        const { error } = await supabase
          .from('likes')
          .insert({
            question_id: question.id,
            user_id: user?.id || null, // Record user ID if authenticated
            fingerprint: fingerprint
          });

        if (error) {
          // If error is about unique constraint, it means it was already liked
          if (error.code === '23505') {
            console.warn('Attempted to like a question that was already liked.');
            // Revert local state (it was an invalid optimistic update)
            setLocalLikes(localLikes);
            setIsLiked(isLiked);
            return;
          }
          // Revert on other errors
          setLocalLikes(localLikes);
          setIsLiked(isLiked);
          throw error;
        }
      }
    } catch (error) {
      console.error('Error updating likes:', error);
      // Revert local state if any error occurred
      setLocalLikes(localLikes);
      setIsLiked(isLiked);
    }
  };

  // Truncate question text if it's longer than 100 characters
  const truncatedQuestion = question.question.length > 100 
    ? `${question.question.slice(0, 100)}...`
    : question.question

  const cardContent = (
    <div className="flex flex-col h-full justify-between font-oswald">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm text-gray-700 mb-1 font-oswald">
          <User className="w-5 h-5 flex-shrink-0 text-black" />
          <span className="truncate">{question.questioned_by || 'Anonymous'}</span>
        </div>
        <p
          onClick={() => setShowModal(true)}
          className="break-words text-black cursor-pointer hover:text-gray-800 transition-colors mt-4 font-oswald"
        >
          {truncatedQuestion}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-700 mt-4 pt-4 border-t-2 border-black border-dashed font-oswald">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 flex-shrink-0 text-black" />
            <span>{timeAgo}</span>
            <span className="text-black">•</span>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 cursor-pointer hover:text-black transition-colors p-1 -m-1 rounded-xl font-oswald">
              <MessageSquare className="w-4 h-4 flex-shrink-0 text-black" />
              <span>{question.comments_count || 0}</span>
            </button>
          </div>
          <button
            onClick={handleLikeClick}
            className={`flex items-center gap-1.5 transition-colors p-1 -m-1 rounded-xl font-oswald ${isLiked ? 'text-black hover:text-gray-800' : 'text-gray-700 hover:text-black'}`}
          >
            <Heart fill={isLiked ? "black" : "none"} className="w-4 h-4 flex-shrink-0" />
            <span>{localLikes}</span>
          </button>
        </div>
      </div>
    </div>
  );

  // if (isOverlay) {
  //   return (
  //     <div className={clsx(
  //       'bg-white p-6 rounded-xl shadow-lg border-2 border-black font-oswald',
  //       isDragging && 'opacity-50'
  //     )}>
  //       {cardContent}
  //     </div>
  //   );
  // }

  return (
    <>
      <div
        // ref={setNodeRef}
        // style={style}
        className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg border-2 border-black relative font-oswald"
      >
        <div className="flex items-start justify-between gap-4 h-full">
          <div className="flex-1 min-w-0 h-full">
            {cardContent}
          </div>
        </div>
        {sortOrder !== 'popular' && (
          <div className="absolute top-0 right-0 -mt-3 -mr-3">
            <div className="bg-gray-100 text-black text-xs font-bold px-2.5 py-1 rounded-xl border-2 border-black shadow-sm font-oswald">
              #{question.question_number}
            </div>
          </div>
        )}
      </div>
      {/* Question Detail Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl rounded-xl sm:w-full overflow-y-auto border-2 border-black shadow-xl font-oswald">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b-2 border-black px-4 py-4 sm:px-6 sm:py-4 flex justify-between items-center shadow-sm font-oswald">
              <h2 className="text-xl font-bold text-black font-oswald">Question Details</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-black hover:text-gray-700 transition-colors p-1 -mr-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-6 font-oswald">
              {/* Question Info */}
              <div className="flex items-center gap-1.5 text-sm text-gray-700 mb-2 font-oswald">
                <User className="w-5 h-5 flex-shrink-0 text-black" />
                <span className="truncate">{question.questioned_by || 'Anonymous'}</span>
              </div>
              <p className="text-lg pb-6 border-b-2 border-black text-black mt-4 font-oswald">
                {question.question}
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-700 mt-4 font-oswald">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 flex-shrink-0 text-black" />
                    <span>{timeAgo}</span>
                    <span className="text-black">•</span>
                    <div onClick={() => setIsCommentsOpen(!isCommentsOpen)} className="flex items-center gap-1.5 cursor-pointer hover:text-black transition-colors font-oswald">
                      <MessageSquare className="w-4 h-4 flex-shrink-0 text-black" />
                      <span>{question.comments_count || 0}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleLikeClick}
                    className={`flex items-center gap-1.5 transition-colors p-1 -m-1 rounded-xl font-oswald ${isLiked ? 'text-black hover:text-gray-800' : 'text-gray-700 hover:text-black'}`}
                  >
                    <Heart fill={isLiked ? "black" : "none"} className="w-4 h-4 flex-shrink-0" />
                    <span>{localLikes}</span>
                  </button>
                </div>
              </div>
              {/* Comments Section */}
              <div className="mt-6 font-oswald">
                <CommentSection questionId={question.id} userName={userName} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default memo(QuestionCard);