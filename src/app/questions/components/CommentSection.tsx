// components/CommentSection.tsx
'use client'

import { Comment, supabase } from '@/utils/supabase' // Assuming Comment interface is defined in supabase utils
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useState } from 'react'
import { User, Send } from 'lucide-react'; // Added Lucide icons for consistency
import toast from 'react-hot-toast';

  interface CommentSectionProps {
    questionId: string
    userName: string
}

export default function CommentSection({ questionId, userName }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchComments()
    // Subscribe to new comments
    const channel = supabase
      .channel(`comments_for_question_${questionId}`) // Use unique channel name
      .on(
        'postgres_changes',
        {
          event: 'INSERT', // Only listen for INSERT events for new comments
          schema: 'public',
          table: 'comments',
          filter: `question_id=eq.${questionId}`,
        },
        (payload) => {
          console.log('Comment received!', payload);
          setComments((prev) => [...prev, payload.new as Comment])
        }
      )
      .subscribe()

      return () => {
        channel.unsubscribe();
      };
  }, [questionId, supabase]) // Added supabase to dependencies for safety

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('question_id', questionId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching comments:', error);
    } else if (data) {
      setComments(data);
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setIsLoading(true)
    try {
      const { error } = await supabase.from('comments').insert({
        question_id: questionId,
        comment: newComment.trim(),
        commented_by: userName
      })

      if (error) throw error
      setNewComment('')
      // No need to call fetchComments() here, Realtime subscription will handle update
    } catch (error) {
      console.error('Error submitting comment:', error)
      toast.error('Failed to post comment.'); // Add toast notification
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full font-oswald">
      <h3 className="text-sm font-bold text-black mb-4">Comments</h3>
      {/* Comments List */}
      <div className="flex-1 space-y-4 mb-4 min-h-0 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="text-sm text-gray-700 text-center py-4 border-2 border-dashed border-black rounded-xl shadow-sm font-oswald">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="bg-white rounded-xl p-4 border-2 border-black shadow-sm font-oswald">
              <p className="text-black mb-2 break-words font-oswald">{comment.comment}</p>
              <div className="flex items-center gap-2 text-sm text-gray-700 font-oswald">
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-black" />
                  <span>{comment.commented_by || 'Anonymous'}</span>
                </div>
                <span className="text-black">•</span>
                <span className="text-xs">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Add Comment Form - Fixed at bottom on mobile */}
      <div className="sticky bottom-0 bg-white pt-2 border-t-2 border-black font-oswald">
        <form onSubmit={handleSubmitComment} className="flex gap-2">
          <input
            type="text"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1 px-4 py-2 bg-white border-2 border-black rounded-xl text-black focus:outline-none focus:ring-0 focus:border-black transition-all shadow-sm font-oswald"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !newComment.trim()}
            className="bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-all shadow-md font-bold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap border-2 border-black font-oswald"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  )
}