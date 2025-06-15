'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Edit, Save, Image as ImageIcon, ArrowUp, ArrowDown, Eye, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ModalLoading from '@/app/components/ModalLoading';
import Link from 'next/link';

interface Quiz {
  id: string;
  title: string;
  description: string;
  is_published: boolean;
  time_limit: number | null;
  total_points: number;
}

interface Question {
  id?: string;
  question_text: string;
  question_type: 'multiple_choice' | 'yes_no' | 'short_answer';
  points: number;
  order_index: number;
  image_url: string | null;
  correct_answer: string;
  options?: {
    id?: string;
    option_text: string;
    is_correct: boolean;
    order_index: number;
  }[];
}

export default function QuizCreator() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [newQuiz, setNewQuiz] = useState({
    title: '',
    description: '',
    time_limit: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: quizzesData, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuizzes(quizzesData || []);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      toast.error('Failed to load quizzes');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchQuestions = async (quizId: string) => {
    try {
      const { data: questionsData, error } = await supabase
        .from('quiz_questions')
        .select(`
          *,
          options:quiz_question_options(*)
        `)
        .eq('quiz_id', quizId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setQuestions(questionsData || []);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error('Failed to load questions');
    }
  };

  const handleCreateQuiz = async () => {
    if (!newQuiz.title.trim()) {
      toast.error('Please enter a quiz title');
      return;
    }

    try {
      setIsSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('quizzes')
        .insert([
          {
            title: newQuiz.title.trim(),
            description: newQuiz.description.trim(),
            user_id: user.id,
            time_limit: newQuiz.time_limit || null
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setQuizzes([data, ...quizzes]);
      setSelectedQuiz(data);
      setQuestions([]);
      setShowCreateModal(false);
      setNewQuiz({ title: '', description: '', time_limit: 0 });
      toast.success('Quiz created successfully');
      
      // Redirect to the new quiz's edit page
      router.push(`/dashboard/quiz-creator/${data.id}`);
    } catch (error) {
      console.error('Error creating quiz:', error);
      toast.error('Failed to create quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddQuestion = () => {
    if (questions.length >= 30) {
      toast.error('Maximum 30 questions allowed');
      return;
    }

    const newQuestion: Question = {
      question_text: '',
      question_type: 'multiple_choice',
      points: 1,
      order_index: questions.length,
      image_url: null,
      correct_answer: '',
      options: [
        { option_text: '', is_correct: false, order_index: 0 },
        { option_text: '', is_correct: false, order_index: 1 },
        { option_text: '', is_correct: false, order_index: 2 },
        { option_text: '', is_correct: false, order_index: 3 }
      ]
    };

    setQuestions([...questions, newQuestion]);
  };

  const handleQuestionChange = (index: number, field: keyof Question, value: any) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      [field]: value
    };
    setQuestions(updatedQuestions);
  };

  const handleOptionChange = (questionIndex: number, optionIndex: number, field: string, value: any) => {
    const updatedQuestions = [...questions];
    if (!updatedQuestions[questionIndex].options) {
      updatedQuestions[questionIndex].options = [];
    }
    updatedQuestions[questionIndex].options![optionIndex] = {
      ...updatedQuestions[questionIndex].options![optionIndex],
      [field]: value
    };
    setQuestions(updatedQuestions);
  };

  const handleImageUpload = async (questionIndex: number, file: File) => {
    try {
      setUploadingImage(questionIndex.toString());
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `quiz-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('quiz-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('quiz-images')
        .getPublicUrl(filePath);

      handleQuestionChange(questionIndex, 'image_url', publicUrl);
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSaveQuestion = async (questionIndex: number) => {
    if (!selectedQuiz) return;

    const question = questions[questionIndex];
    if (!question.question_text.trim()) {
      toast.error('Please enter a question');
      return;
    }

    try {
      setIsSubmitting(true);
      let questionId = question.id;

      if (!questionId) {
        // Insert new question
        const { data, error } = await supabase
          .from('quiz_questions')
          .insert([
            {
              quiz_id: selectedQuiz.id,
              question_text: question.question_text,
              question_type: question.question_type,
              points: question.points,
              order_index: question.order_index,
              image_url: question.image_url,
              correct_answer: question.correct_answer
            }
          ])
          .select()
          .single();

        if (error) throw error;
        questionId = data.id;

        // Insert options for multiple choice questions
        if (question.question_type === 'multiple_choice' && question.options) {
          const { error: optionsError } = await supabase
            .from('quiz_question_options')
            .insert(
              question.options.map(option => ({
                question_id: questionId,
                option_text: option.option_text,
                is_correct: option.is_correct,
                order_index: option.order_index
              }))
            );

          if (optionsError) throw optionsError;
        }
      } else {
        // Update existing question
        const { error } = await supabase
          .from('quiz_questions')
          .update({
            question_text: question.question_text,
            question_type: question.question_type,
            points: question.points,
            order_index: question.order_index,
            image_url: question.image_url,
            correct_answer: question.correct_answer
          })
          .eq('id', questionId);

        if (error) throw error;

        // Update options for multiple choice questions
        if (question.question_type === 'multiple_choice' && question.options) {
          // Delete existing options
          await supabase
            .from('quiz_question_options')
            .delete()
            .eq('question_id', questionId);

          // Insert new options
          const { error: optionsError } = await supabase
            .from('quiz_question_options')
            .insert(
              question.options.map(option => ({
                question_id: questionId,
                option_text: option.option_text,
                is_correct: option.is_correct,
                order_index: option.order_index
              }))
            );

          if (optionsError) throw optionsError;
        }
      }

      await fetchQuestions(selectedQuiz.id);
      toast.success('Question saved successfully');
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('Failed to save question');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (questionIndex: number) => {
    const question = questions[questionIndex];
    if (!question.id) {
      setQuestions(questions.filter((_, index) => index !== questionIndex));
      return;
    }

    try {
      const { error } = await supabase
        .from('quiz_questions')
        .delete()
        .eq('id', question.id);

      if (error) throw error;

      setQuestions(questions.filter((_, index) => index !== questionIndex));
      toast.success('Question deleted successfully');
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Failed to delete question');
    }
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === questions.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updatedQuestions = [...questions];
    const temp = updatedQuestions[index];
    updatedQuestions[index] = updatedQuestions[newIndex];
    updatedQuestions[newIndex] = temp;

    // Update order_index
    updatedQuestions.forEach((q, i) => {
      q.order_index = i;
    });

    setQuestions(updatedQuestions);
  };

//   if (isLoading) {
//     return (
//         <div className="min-h-screen flex items-center justify-center">
//             <ModalLoading isOpen={isLoading} />
//         </div>
//     );
//   }

    return (
    <div>
      {/* Quiz Creator Title */}
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-4xl font-extrabold text-black mb-2">Quiz Creator</h1>
        <p className="text-gray-700 text-xl mb-4">Create and manage your quizzes</p>
      </div>

      {/* Quiz List Section */}
      <div className="bg-white rounded-lg shadow p-6 border-2 border-black mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-black">My Quizzes</h2>
            <p className="text-sm text-gray-500 mt-1">Showing {quizzes.length} quizzes</p>
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
        ) : quizzes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-none border-2 border-dashed border-black shadow-lg">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-none bg-gray-100 mb-4 border-2 border-black">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-black mb-2">No Quizzes Yet</h3>
            <p className="text-gray-700 mb-6">Create your first quiz to get started!</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white hover:bg-gray-800 transition-all shadow-md rounded-lg"
            >
              <Plus className="w-5 h-5" />
              Create Your First Quiz
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {quizzes.map((quiz) => (
              <Link
                key={quiz.id}
                href={`/dashboard/quiz-creator/${quiz.id}`}
                className="group relative bg-white rounded-xl border-dashed border-black shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border-2"
              >
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-black transition-colors line-clamp-1 flex items-center">
                    {quiz.title}
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-none text-xs font-medium bg-gray-100 text-black border border-black">
                      {quiz.total_points} points
                    </span>
                  </h3>
                  <p className="text-sm text-gray-500 mt-2">
                    {quiz.description}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                    {quiz.time_limit && (
                      <span className="inline-flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {quiz.time_limit} min
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-none text-xs font-medium ${
                      quiz.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    } border border-black`}>
                      {quiz.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Quiz Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 pt-20">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-black max-w-md w-full p-8 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-black">Create New Quiz</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-black hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-black mb-1">
                  Quiz Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={newQuiz.title}
                  onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-black text-black focus:outline-none focus:ring-1 focus:ring-black transition-all"
                  placeholder="Enter quiz title"
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-black mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={newQuiz.description}
                  onChange={(e) => setNewQuiz({ ...newQuiz, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border-2 border-black text-black focus:outline-none focus:ring-1 focus:ring-black transition-all"
                  placeholder="Enter quiz description"
                />
              </div>
              <div>
                <label htmlFor="timeLimit" className="block text-sm font-medium text-black mb-1">
                  Time Limit (minutes, optional)
                </label>
                <input
                  type="number"
                  id="timeLimit"
                  value={newQuiz.time_limit}
                  onChange={(e) => setNewQuiz({ ...newQuiz, time_limit: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-black text-black focus:outline-none focus:ring-1 focus:ring-black transition-all"
                  placeholder="Enter time limit"
                  min="0"
                />
              </div>
              <div className="flex justify-end gap-4 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-2 rounded-full font-bold text-black bg-white border-2 border-black hover:bg-gray-100 shadow transition-all"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateQuiz}
                  disabled={isSubmitting || !newQuiz.title.trim()}
                  className="px-6 py-2 rounded-full font-bold text-black bg-[#FFD34E] hover:bg-yellow-300 border-2 border-black shadow transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin h-5 w-5 text-black">
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Create Quiz
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* <ModalLoading isOpen={isLoading} /> */}
    </div>
  );
} 