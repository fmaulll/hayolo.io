// app/dashboard/quiz-creator/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

import { Plus, Trash2, Edit, Save, Image as ImageIcon, ArrowUp, ArrowDown, X, ArrowLeft, Loader2, Info, AppWindow, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-hot-toast'; // Ensure react-hot-toast is installed and configured
import ModalLoading from '@/app/components/ModalLoading'; // Assuming this component exists and is correctly themed
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid'; // For unique temporary IDs for new questions/image uploads

// --- INTERFACES (Ensure these are comprehensive and accurate) ---
interface Quiz {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  time_limit: number | null;
  total_points: number; // Assuming total points are managed/calculated
  user_id: string; // Add user_id to Quiz interface for ownership check
}

interface Option {
  id?: string; // Optional for new options
  option_text: string;
  is_correct: boolean;
  order_index: number;
}

interface Question {
  id?: string; // Optional for new questions not yet saved (will be assigned by DB on insert)
  quiz_id?: string; // Add quiz_id to Question, crucial for inserts/updates
  question_text: string;
  question_type: 'multiple_choice' | 'yes_no' | 'short_answer';
  points: number;
  order_index: number;
  image_url: string | null;
  correct_answer: string; // Correct answer for SA, Yes/No, and internally for MC text
  options?: Option[]; // Use the Option interface
  time_limit?: number; // in seconds
  user_id?: string; // Add user_id to Question interface for ownership check
}

export default function EditQuiz({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Initial page loading state
  const [isSavingQuizDetails, setIsSavingQuizDetails] = useState(false); // For global quiz details save
  const [isEditingQuizDetails, setIsEditingQuizDetails] = useState(false); // State for editing quiz details section
  const [editedQuizDetails, setEditedQuizDetails] = useState({
    title: '',
    description: '',
    time_limit: 0
  });

  // Track submission/deletion states for individual questions (keyed by temp ID or actual ID)
  // Use a map with question.id or a unique temporary key (e.g., uuid) for questions not yet saved.
  const [questionProcessingStates, setQuestionProcessingStates] = useState<Record<string, 'saving' | 'deleting' | 'uploading_image' | null>>({});

  // Add state for previewed question
  const [previewIndex, setPreviewIndex] = useState(0);

  // Add state for open question dropdown
  const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchQuizAndQuestions();
    // Re-fetch when params.id changes, or supabase/router if they cause re-render/context change
  }, [params.id, supabase, router]);

  const fetchQuizAndQuestions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      // Fetch quiz details
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id) // Ensure only owner can edit
        .single();

      if (quizError || !quizData) { // Check for !quizData as well
        console.error('Error fetching quiz data:', quizError || 'Quiz not found.');
        toast.error('Quiz not found or you are not authorized.');
        router.replace('/dashboard/quiz-creator'); // Redirect if not found or unauthorized
        return;
      }
      setQuiz(quizData);
      setEditedQuizDetails({
        title: quizData.title,
        description: quizData.description || '', // Ensure it's a string for textarea
        time_limit: quizData.time_limit || 0
      });

      // Fetch questions and their options
      const { data: questionsData, error: questionsError } = await supabase
        .from('quiz_questions')
        .select(`
          id,
          quiz_id,
          question_text,
          question_type,
          points,
          order_index,
          image_url,
          correct_answer,
          time_limit,
          options:quiz_question_options(id, option_text, is_correct, order_index)
        `)
        .eq('quiz_id', params.id)
        .order('order_index', { ascending: true }); // Always sort by order_index

      if (questionsError) throw questionsError;

      // Ensure options are sorted for consistency in display
      const processedQuestions = questionsData ? questionsData.map(q => ({
        ...q,
        // Ensure options is always an array, and sort them
        options: q.options ? q.options.sort((a, b) => a.order_index - b.order_index) : []
      })) : [];

      console.log(processedQuestions);
      setQuestions(processedQuestions);
    } catch (error) {
      console.error('Error fetching quiz data:', error); // Log original error
      toast.error('Failed to load quiz. Redirecting...');
      router.replace('/dashboard/quiz-creator');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateQuizDetails = async () => {
    if (!quiz) return; // Should not happen if page is rendered

    const trimmedTitle = editedQuizDetails.title.trim();
    if (!trimmedTitle) {
      toast.error('Quiz title cannot be empty.');
      return;
    }

    try {
      setIsSavingQuizDetails(true);
      const { error } = await supabase
        .from('quizzes')
        .update({
          title: trimmedTitle,
          description: editedQuizDetails.description.trim() || null, // Convert empty string to null for DB
          time_limit: editedQuizDetails.time_limit || null
        })
        .eq('id', quiz.id); // Use quiz.id

      if (error) throw error;

      // Update local quiz state and exit editing mode
      setQuiz(prev => prev ? {
        ...prev,
        title: trimmedTitle,
        description: editedQuizDetails.description.trim() || null,
        time_limit: editedQuizDetails.time_limit || null
      } : null);
      setIsEditingQuizDetails(false);
      toast.success('Quiz details updated successfully!');
    } catch (error) {
      console.error('Error updating quiz details:', error);
      toast.error('Failed to update quiz details.');
    } finally {
      setIsSavingQuizDetails(false);
    }
  };

  const handleAddQuestion = () => {
    if (questions.length >= 30) {
      toast.error('You can have a maximum of 30 questions per quiz.');
      return;
    }

    const newQuestion: Question = {
      // No ID here, it will be assigned by DB on insert
      question_text: '',
      question_type: 'multiple_choice', // Default type for new questions
      points: 1, // Default points
      order_index: questions.length, // Place at the end
      image_url: null,
      correct_answer: '',
      options: [ // Always initialize with 4 options for multiple choice
        { option_text: '', is_correct: false, order_index: 0 },
        { option_text: '', is_correct: false, order_index: 1 },
        { option_text: '', is_correct: false, order_index: 2 },
        { option_text: '', is_correct: false, order_index: 3 }
      ],
      time_limit: 0,
    };

    setQuestions([...questions, newQuestion]);
    // Scroll to the new question after adding it
    setTimeout(() => {
        // Use a temporary unique ID for scrolling to newly added (unsaved) questions
        const tempScrollId = `question-new-${newQuestion.order_index}`;
        document.getElementById(tempScrollId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100); // Small delay to allow render
  };

  const handleQuestionFieldChange = (index: number, field: keyof Question, value: any) => {
    const updatedQuestions = [...questions];
    const question = updatedQuestions[index];

    if (field === 'options') {
      // For options, ensure we have a valid array
      question.options = value || [];
      // If this is a multiple choice question, update correct_answer based on the correct option
      if (question.question_type === 'multiple_choice' && question.options) {
        const correctOption = question.options.find(opt => opt.is_correct);
        question.correct_answer = correctOption?.option_text || '';
      }
    } else if (field === 'question_type') {
      // When changing question type, reset options and correct_answer
      question.question_type = value;
      if (value === 'multiple_choice') {
        question.options = [
          { option_text: '', is_correct: true, order_index: 0 },
          { option_text: '', is_correct: false, order_index: 1 }
        ];
        question.correct_answer = '';
      } else {
        question.options = [];
        question.correct_answer = '';
      }
    } else if (field === 'points') {
      // Ensure points are a valid number
      question.points = Math.max(1, parseInt(value) || 1);
    } else if (field === 'time_limit') {
      question.time_limit = value;
    } else {
      // For all other fields, update directly
      (question as any)[field] = value;
    }

    setQuestions(updatedQuestions);
  };

  const handleOptionChange = (questionIndex: number, optionIndex: number, field: string, value: any) => {
    const updatedQuestions = [...questions];
    const currentQuestion = updatedQuestions[questionIndex];

    if (!currentQuestion.options) {
      currentQuestion.options = []; // Initialize if null/undefined
    }

    // Handle is_correct (radio button logic)
    if (field === 'is_correct') {
      currentQuestion.options = currentQuestion.options.map((opt, i) => ({
        ...opt,
        is_correct: i === optionIndex ? value : false // Only the selected one is true
      }));
       // Update correct_answer on the question directly based on selected option's text
       updatedQuestions[questionIndex].correct_answer = currentQuestion.options[optionIndex].option_text;

    } else { // Handle option_text change
      currentQuestion.options[optionIndex] = {
        ...currentQuestion.options[optionIndex],
        [field]: value
      };
      // If this option is currently marked as correct, update correct_answer on the question
      if (currentQuestion.options[optionIndex].is_correct) {
          updatedQuestions[questionIndex].correct_answer = value;
      }
    }
    setQuestions(updatedQuestions);
  };

  const handleImageUpload = async (questionIndex: number, file: File) => {
    if (!quiz) return; // Ensure quiz is loaded
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // Max 2MB limit
        toast.error('Image size must be less than 2MB.');
        return;
    }

    const questionIdForState = questions[questionIndex].id || `new-q-${questionIndex}`; // Use ID or temp key
    
    try {
      setQuestionProcessingStates(prev => ({ ...prev, [questionIdForState]: 'uploading_image' })); // Set uploading state for this specific question
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`; // Use UUID for unique filenames
      const filePath = `quiz-images/${quiz.id}/${fileName}`; // Store images per quiz in a subfolder

      // Upload image to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('quiz-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('quiz-images')
        .getPublicUrl(filePath);

      handleQuestionFieldChange(questionIndex, 'image_url', publicUrl);
      toast.success('Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setQuestionProcessingStates(prev => ({ ...prev, [questionIdForState]: null })); // Clear uploading state
    }
  };

  const handleSaveQuestion = async (questionIndex: number) => {
    if (!quiz) {
      toast.error('Quiz data not loaded. Cannot save question.');
      return;
    }

    const question = questions[questionIndex];
    const isNewQuestion = !question.id;
    const saveId = question.id || `new-q-${questionIndex}`; // Unique ID for state tracking

    // --- Validation ---
    if (!question.question_text.trim()) {
      toast.error('Question text cannot be empty.');
      return;
    }

    if (question.question_type === 'multiple_choice') {
        if (!question.options || question.options.length === 0) {
            toast.error('Multiple choice questions must have options.');
            return;
        }
        const hasCorrectOption = question.options.some(opt => opt.is_correct);
        if (!hasCorrectOption) {
            toast.error('Multiple choice questions must have at least one correct option.');
            return;
        }
        if (question.options.some(opt => opt.option_text.trim() === '')) {
             toast.error('All multiple choice options must have text.');
             return;
        }
    } else if (question.question_type === 'short_answer') {
        if (!question.correct_answer.trim()) {
            toast.error('Short answer questions must have a correct answer.');
            return;
        }
    } else if (question.question_type === 'yes_no') {
        if (!['yes', 'no'].includes(question.correct_answer.toLowerCase())) {
            toast.error('Yes/No questions must have "yes" or "no" as the correct answer.');
            return;
        }
    }
    // --- End Validation ---

    try {
      setQuestionProcessingStates(prev => ({ ...prev, [saveId]: 'saving' })); // Set saving state for this specific question

      let currentQuestionId = question.id; // This will hold the DB ID for the question

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      // 1. Save/Update main question data
      if (isNewQuestion) {
        console.log("NEW QUESTION");
        const { data, error } = await supabase
          .from('quiz_questions')
          .insert([
            {
              quiz_id: quiz.id,
              question_text: question.question_text.trim(),
              question_type: question.question_type,
              points: question.points,
              order_index: question.order_index,
              image_url: question.image_url,
              correct_answer: question.correct_answer.trim(),
              time_limit: question.time_limit ?? 0,
              user_id: user.id
            }
          ])
          .select()
          .single();

        if (error) throw error;
        currentQuestionId = data.id; // Get the newly assigned ID from DB
      } else { // Existing question
        console.log("EXISTING QUESTION");
        const { error } = await supabase
          .from('quiz_questions')
          .update({
            question_text: question.question_text.trim(),
            question_type: question.question_type,
            points: question.points,
            order_index: question.order_index,
            image_url: question.image_url,
            correct_answer: question.correct_answer.trim(),
            time_limit: question.time_limit ?? 0,
            user_id: user.id
          })
          .eq('id', question.id!); // Use existing ID

        if (error) throw error;
      }

      // 2. Handle options for multiple choice questions
      if (question.question_type === 'multiple_choice' && question.options && currentQuestionId) {
        // Prepare options for upsert: assign question_id and strip temp IDs
        const optionsToUpsert = question.options.map(localOpt => ({
          id: localOpt.id || uuidv4(),
          question_id: currentQuestionId,
          option_text: localOpt.option_text.trim(),
          is_correct: localOpt.is_correct,
          order_index: localOpt.order_index
        }));
        
        // Fetch current options in DB to determine what to delete (if options were removed locally)
        const { data: existingOptionsInDb, error: fetchOptionsError } = await supabase
            .from('quiz_question_options')
            .select('id')
            .eq('question_id', currentQuestionId);
        
        if (fetchOptionsError) throw fetchOptionsError;

        const idsToDelete = existingOptionsInDb
            .filter(dbOpt => !optionsToUpsert.some(upsertOpt => upsertOpt.id === dbOpt.id && upsertOpt.id !== null))
            .map(dbOpt => dbOpt.id);

        if (idsToDelete.length > 0) {
            const { error: deleteError } = await supabase
                .from('quiz_question_options')
                .delete()
                .in('id', idsToDelete);
            if (deleteError) throw deleteError;
        }

        // Perform upsert for all current options
        const { error: optionsUpsertError } = await supabase
            .from('quiz_question_options')
            .upsert(optionsToUpsert, { onConflict: 'id' }).eq('user_id', user.id); // Conflict on id to update existing, insert new

        if (optionsUpsertError) throw optionsUpsertError;

      } else if (question.question_type !== 'multiple_choice' && currentQuestionId) {
        // If question type changed away from MC, ensure all associated options are deleted from DB
        await supabase
          .from('quiz_question_options')
          .delete()
          .eq('question_id', currentQuestionId);
      }

      await fetchQuizAndQuestions(); // Re-fetch all data to ensure local state and DB are perfectly synced
      toast.success(`Question ${isNewQuestion ? 'added' : 'updated'} successfully!`);
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('Failed to save question. Please try again.');
    } finally {
      setQuestionProcessingStates(prev => ({ ...prev, [saveId]: null })); // Clear saving state
    }
  };

  const handleDeleteQuestion = async (questionIndex: number) => {
    const question = questions[questionIndex];
    const deleteId = question.id || `new-q-${questionIndex}`; // Use ID or temp key for state tracking

    // If it's a new, unsaved question, just remove from local state immediately
    if (!question.id) {
      setQuestions(questions.filter((_, idx) => idx !== questionIndex));
      toast.success('Unsaved question removed.');
      return;
    }

    if (!confirm(`Are you sure you want to delete Question ${questionIndex + 1}? This cannot be undone.`)) {
        return; // User cancelled
    }

    try {
      setQuestionProcessingStates(prev => ({ ...prev, [deleteId]: 'deleting' })); // Set deleting state

      const { error } = await supabase
        .from('quiz_questions')
        .delete()
        .eq('id', question.id);

      if (error) throw error;

      await fetchQuizAndQuestions(); // Re-fetch to ensure order_indexes are consistent
      toast.success('Question deleted successfully!');
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Failed to delete question.');
    } finally {
      setQuestionProcessingStates(prev => ({ ...prev, [deleteId]: null })); // Clear deleting state
    }
  };

  const handleMoveQuestion = async (index: number, direction: 'up' | 'down') => {
    if (!quiz) return;
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === questions.length - 1)
    ) {
      return; // Cannot move beyond bounds
    }

    // Optimistically update UI
    const updatedQuestions = [...questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    // Swap items in the local array
    [updatedQuestions[index], updatedQuestions[newIndex]] = [updatedQuestions[newIndex], updatedQuestions[index]];

    // Update order_index property for the swapped questions (local state)
    // IMPORTANT: Ensure these are updated for the correct, swapped items
    updatedQuestions[index].order_index = index;
    updatedQuestions[newIndex].order_index = newIndex;
    console.log(updatedQuestions);

    setQuestions(updatedQuestions); // Update local state immediately

    // Save changes to order_index in database for the two swapped questions
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.replace('/login');
            return;
        }
        const { error } = await supabase.from('quiz_questions').upsert([
            { id: updatedQuestions[index].id, order_index: updatedQuestions[index].order_index, correct_answer: updatedQuestions[index].correct_answer, question_text: updatedQuestions[index].question_text, question_type: updatedQuestions[index].question_type, points: updatedQuestions[index].points, time_limit: updatedQuestions[index].time_limit, image_url: updatedQuestions[index].image_url, quiz_id: quiz.id },
            { id: updatedQuestions[newIndex].id, order_index: updatedQuestions[newIndex].order_index, correct_answer: updatedQuestions[newIndex].correct_answer, question_text: updatedQuestions[newIndex].question_text, question_type: updatedQuestions[newIndex].question_type, points: updatedQuestions[newIndex].points, time_limit: updatedQuestions[newIndex].time_limit, image_url: updatedQuestions[newIndex].image_url, quiz_id: quiz.id }
        ]).eq('user_id', user.id); // Use upsert on 'id' to update existing rows
        if (error) throw error;
        toast.success('Question order updated.');
    } catch (error) {
        console.error('Error saving new question order:', error);
        toast.error('Failed to update question order.');
        // Revert to original order if DB update fails to avoid data inconsistency
        fetchQuizAndQuestions(); // Perform a full re-fetch to ensure consistency
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ModalLoading isOpen={isLoading} />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-none shadow-lg border-2 border-black">
          <h2 className="text-2xl font-bold text-black mb-4">Quiz not found</h2>
          <p className="text-gray-700 mb-6">The quiz with ID "{params.id}" could not be loaded or you don't have access.</p>
          <Link
            href="/dashboard/quiz-creator"
            className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-none font-medium hover:bg-gray-800 transition-all shadow-md border border-black"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Quiz List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Quiz Title & Description */}
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-4xl font-extrabold text-black mb-2">Quiz Editor</h1>
        <p className="text-gray-700 text-xl mb-4">Edit your quiz questions and settings</p>
      </div>

      {/* Quiz Details Section */}
      <div className="bg-white rounded-lg shadow p-6 border-2 border-black mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-black">Quiz Information</h2>
          <button
            onClick={() => setIsEditingQuizDetails(true)}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-black text-black hover:bg-[#FFD34E] transition-all"
          >
            <Edit className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          {isEditingQuizDetails ? (
            <>
              <div>
                <label htmlFor="quizTitle" className="block text-sm font-medium text-black mb-1">
                  Quiz Title
                </label>
                <input
                  type="text"
                  id="quizTitle"
                  value={editedQuizDetails.title}
                  onChange={(e) => setEditedQuizDetails({ ...editedQuizDetails, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200 text-black"
                  placeholder="Enter quiz title..."
                />
              </div>
              <div>
                <label htmlFor="quizDescription" className="block text-sm font-medium text-black mb-1">
                  Description
                </label>
                <textarea
                  id="quizDescription"
                  value={editedQuizDetails.description}
                  onChange={(e) => setEditedQuizDetails({ ...editedQuizDetails, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200 text-black"
                  placeholder="Enter quiz description..."
                  rows={3}
                />
              </div>
              {/* <div>
                <label htmlFor="timeLimit" className="block text-sm font-medium text-black mb-1">
                  Time Limit (minutes)
                </label>
                <input
                  type="number"
                  id="timeLimit"
                  value={editedQuizDetails.time_limit}
                  onChange={(e) => setEditedQuizDetails({ ...editedQuizDetails, time_limit: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200 text-black"
                  placeholder="0 (no limit)"
                  min="0"
                />
              </div> */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleUpdateQuizDetails}
                  disabled={isSavingQuizDetails}
                  className="flex-1 px-4 py-2 rounded-lg text-white font-medium bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
                >
                  {isSavingQuizDetails ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsEditingQuizDetails(false);
                    setEditedQuizDetails({
                      title: quiz.title,
                      description: quiz.description || '',
                      time_limit: quiz.time_limit || 0
                    });
                  }}
                  className="flex-1 px-4 py-2 rounded-lg border-2 border-black text-black hover:bg-gray-100 transition-all duration-200 flex items-center justify-center"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-black">{quiz.title}</h3>
                  <p className="text-gray-600 mt-1">{quiz.description || 'No description provided'}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-sm text-gray-600">{quiz.total_points || 0} total points</span>
                    {/* {quiz.time_limit ? (
                      <span className="text-sm text-gray-600">{quiz.time_limit} minutes</span>
                    ) : (
                      <span className="text-sm text-gray-600">No time limit</span>
                    )} */}
                    <span className="px-2.5 py-0.5 rounded-none text-xs font-medium bg-gray-100 text-black border border-black">
                      {quiz.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Two-column layout: Preview & Questions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Preview Section */}
        <div className="bg-white rounded-lg shadow-lg border-2 border-black p-6 min-h-[420px] max-h-[720px] sticky top-8 self-start">
          <h2 className="text-xl font-bold text-black mb-4">Preview</h2>
          {questions.length === 0 ? (
            <div className="text-gray-500">No questions to preview.</div>
          ) : (
            <div className="flex flex-col border-2 border-black rounded-lg overflow-hidden">
              {/* Browser Header */}
              <div className="bg-gray-100 border-b-2 border-black p-2 flex items-center gap-2">
                {/* Navigation Buttons */}
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                
                {/* URL Bar */}
                <div className="flex-1 bg-white border-2 border-black rounded-md px-3 py-1 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                  <span className="text-sm text-gray-600 truncate">quiz.example.com/question/{previewIndex + 1}</span>
                </div>
              </div>

              {/* Browser Content */}
              <div className="flex flex-col items-center p-6 bg-white">
                <div className="mb-2 text-sm text-gray-600">Question {previewIndex + 1} of {questions.length}</div>
                
                {/* Question Text */}
                <div className="font-medium text-2xl mb-4 text-center text-black w-full">
                  {questions[previewIndex].question_text || <span className="text-gray-400">(No question text)</span>}
                </div>

                {/* Image Section */}
                {questions[previewIndex].image_url && (
                  <div className="w-full mb-6 flex justify-center">
                    <img 
                      src={questions[previewIndex].image_url} 
                      alt="Preview" 
                      className="max-h-48 rounded-lg border-2 border-black object-contain"
                    />
                  </div>
                )}

                {/* Options Section */}
                <div className="w-full">
                  {questions[previewIndex].question_type === 'multiple_choice' && questions[previewIndex].options && (
                    <div className="grid grid-cols-2 gap-4">
                      {questions[previewIndex].options.map((opt, i) => (
                        <div 
                          key={i} 
                          className={`p-4 rounded-lg border-2 text-center text-lg font-medium transition-colors
                            ${opt.is_correct 
                              ? 'border-green-500 bg-green-50 text-green-700' 
                              : 'border-gray-300 hover:border-gray-400 text-black'}`}
                        >
                          {opt.option_text}
                        </div>
                      ))}
                    </div>
                  )}

                  {questions[previewIndex].question_type === 'yes_no' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg border-2 border-gray-300 text-center text-lg font-medium hover:border-gray-400">
                        Yes
                      </div>
                      <div className="p-4 rounded-lg border-2 border-gray-300 text-center text-lg font-medium hover:border-gray-400">
                        No
                      </div>
                    </div>
                  )}

                  {questions[previewIndex].question_type === 'short_answer' && (
                    <div className="p-4 rounded-lg border-2 border-gray-300 text-center text-lg font-medium">
                      <span className="text-gray-500">Type your answer here...</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 text-sm text-gray-500">Points: {questions[previewIndex].points}</div>
              </div>
            </div>
          )}
        </div>

        {/* Questions Section */}
        <div className="bg-white rounded-lg shadow-lg border-2 border-black p-6 min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-black">Questions</h2>
              <p className="text-sm text-gray-500 mt-1">{questions.length} questions added</p>
            </div>
            <button
              onClick={handleAddQuestion}
              disabled={questions.length >= 30}
              className="px-4 py-2 rounded-full border-2 border-black text-black bg-[#FFD34E] hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center font-bold"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Question {questions.length >= 30 && '(Max 30)'}
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-none border-2 border-dashed border-black shadow-lg">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-none bg-gray-100 mb-4 border-2 border-black">
                <Info className="h-8 w-8 text-black" />
              </div>
              <h3 className="text-lg font-semibold text-black mb-2">No Questions Added Yet</h3>
              <p className="text-gray-700 mb-6">Start building your quiz by adding your first question.</p>
              <button
                onClick={handleAddQuestion}
                className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white hover:bg-gray-800 transition-all shadow-md rounded-lg"
              >
                <Plus className="w-5 h-5" />
                Add Your First Question
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => {
                const questionIdForState = question.id || `new-q-${index}`;
                const isSaving = questionProcessingStates[questionIdForState] === 'saving';
                const isDeleting = questionProcessingStates[questionIdForState] === 'deleting';
                const isUploading = questionProcessingStates[questionIdForState] === 'uploading_image';
                const isOpen = openQuestionIndex === index;

                return (
                  <div
                    key={question.id || `new-q-${index}`}
                    className="mb-4 border-2 border-black rounded-lg bg-gray-50/50 transition-all duration-200 hover:bg-gray-100"
                  >
                    <div className="flex items-start justify-between mb-0 cursor-pointer select-none px-4 py-3"
                      onClick={() => setOpenQuestionIndex(isOpen ? null : index)}
                    >
                      <div className="flex items-center">
                        <button
                          type="button"
                          className="text-sm font-medium text-black bg-gray-100 px-2 py-1 rounded-md border-2 border-black cursor-pointer flex items-center gap-2"
                        >
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <span className="ml-4 text-sm font-medium text-black bg-gray-100 px-2 py-1 rounded-md border-2 border-black">
                          Question {index + 1}
                        </span>
                        <button
                          type="button"
                          className="text-sm font-medium text-black bg-gray-100 px-2 py-1 rounded-md border-2 border-black cursor-pointer ml-4 flex items-center gap-2"
                          onClick={e => { e.stopPropagation(); setPreviewIndex(index); }}
                          disabled={previewIndex === index}
                        >
                          <AppWindow className="w-4 h-4" />
                          Preview
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); handleMoveQuestion(index, 'up'); }}
                          disabled={index === 0 || isSaving || isDeleting || isUploading}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-none border-2 border-black text-black hover:bg-gray-100 transition-all disabled:opacity-50"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleMoveQuestion(index, 'down'); }}
                          disabled={index === questions.length - 1 || isSaving || isDeleting || isUploading}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-none border-2 border-black text-black hover:bg-gray-100 transition-all disabled:opacity-50"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteQuestion(index); }}
                          disabled={isSaving || isDeleting || isUploading}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-none border-2 border-black text-black hover:bg-gray-100 transition-all disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    {!isOpen && <h2 className="ml-4 text-base font-semibold text-black pb-4 cursor-pointer" 
                      onClick={() => setOpenQuestionIndex(isOpen ? null : index)}>
                      {question.question_text ? question.question_text.length > 30 ? question.question_text.slice(0, 50) + '...' : question.question_text : <span className="text-gray-400">(No question text)</span>}
                    </h2>}
                    {isOpen && (
                      <div className="pt-4 px-4 pb-2">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-black mb-1">
                              Question Type
                            </label>
                            <select
                              value={question.question_type || ''}
                              onChange={(e) => handleQuestionFieldChange(index, 'question_type', e.target.value as Question['question_type'])}
                              className="w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200 text-black"
                              disabled={isSaving || isDeleting || isUploading}
                            >
                              <option value="">Select question type</option>
                              <option value="multiple_choice">Multiple Choice</option>
                              <option value="yes_no">Yes/No</option>
                              <option value="short_answer">Short Answer</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-black mb-1">
                              Question Text
                            </label>
                            <textarea
                              value={question.question_text}
                              onChange={(e) => handleQuestionFieldChange(index, 'question_text', e.target.value)}
                              rows={3}
                              className="w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200 text-black"
                              placeholder="Enter your question"
                              disabled={isSaving || isDeleting || isUploading}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-black mb-1">
                              Points
                            </label>
                            <input
                              type="number"
                              value={question.points}
                              onChange={(e) => handleQuestionFieldChange(index, 'points', parseInt(e.target.value) || 1)}
                              min="1"
                              className="w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200 text-black"
                              disabled={isSaving || isDeleting || isUploading}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-black mb-1">
                              Time Limit
                            </label>
                            <select
                              value={question.time_limit ?? 30}
                              onChange={e => handleQuestionFieldChange(index, 'time_limit', parseInt(e.target.value))}
                              className="w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200 text-black"
                              disabled={isSaving || isDeleting || isUploading}
                            >
                              <option value={0}>No limit</option>
                              <option value={5}>5 seconds</option>
                              <option value={10}>10 seconds</option>
                              <option value={15}>15 seconds</option>
                              <option value={30}>30 seconds</option>
                              <option value={45}>45 seconds</option>
                              <option value={60}>1 minute</option>
                              <option value={120}>2 minutes</option>
                              <option value={180}>3 minutes</option>
                              <option value={300}>5 minutes</option>
                              <option value={600}>10 minutes</option>
                              <option value={900}>15 minutes</option>
                              <option value={1200}>20 minutes</option>
                              <option value={1800}>30 minutes</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-black mb-1">
                              Question Image (optional)
                            </label>
                            <div className="flex items-center gap-4">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(index, file);
                                }}
                                className="hidden"
                                id={`image-upload-${index}`}
                                disabled={isSaving || isDeleting || isUploading}
                              />
                              <label
                                htmlFor={`image-upload-${index}`}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-black text-black hover:bg-gray-100 transition-all cursor-pointer disabled:opacity-50"
                              >
                                {isUploading ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <ImageIcon className="w-4 h-4" />
                                    Upload Image
                                  </>
                                )}
                              </label>
                              {question.image_url && (
                                <div className="relative w-24 h-24 flex-shrink-0">
                                  <img
                                    src={question.image_url}
                                    alt="Question preview"
                                    className="w-full h-full object-cover border-2 border-black rounded-lg"
                                  />
                                  <button
                                    onClick={() => handleQuestionFieldChange(index, 'image_url', null)}
                                    className="absolute -top-2 -right-2 bg-black text-white p-1 rounded-none hover:bg-gray-800 transition-colors border border-white"
                                    title="Remove Image"
                                    disabled={isSaving || isDeleting || isUploading}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {question.question_type === 'multiple_choice' && (
                            <div className="space-y-4 pt-2 border-t-2 border-black border-dashed">
                              <label className="block text-sm font-medium text-black mb-1">
                                Options (select one correct)
                              </label>
                              {(question.options || []).map((option, optionIndex) => (
                                <div key={optionIndex} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 bg-gray-50 border border-black rounded-lg">
                                  <input
                                    type="text"
                                    value={option.option_text}
                                    onChange={(e) => {
                                      const updatedOptions = [...(question.options || [])];
                                      updatedOptions[optionIndex] = {
                                        ...updatedOptions[optionIndex],
                                        option_text: e.target.value
                                      };
                                      handleQuestionFieldChange(index, 'options', updatedOptions);
                                    }}
                                    className="flex-1 px-3 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200 text-black"
                                    placeholder={`Option ${optionIndex + 1} text`}
                                    disabled={isSaving || isDeleting || isUploading}
                                  />
                                  <label className="flex items-center gap-2 flex-shrink-0 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`correct-option-${index}`}
                                      checked={option.is_correct}
                                      onChange={() => {
                                        const updatedOptions = [...(question.options || [])].map((opt, i) => ({
                                          ...opt,
                                          is_correct: i === optionIndex
                                        }));
                                        handleQuestionFieldChange(index, 'options', updatedOptions);
                                      }}
                                      className="w-4 h-4 text-black focus:ring-0 focus:ring-offset-0 border-2 border-black cursor-pointer"
                                      disabled={isSaving || isDeleting || isUploading}
                                    />
                                    <span className="text-sm text-gray-700">Correct</span>
                                  </label>
                                </div>
                              ))}
                            </div>
                          )}

                          {question.question_type === 'yes_no' && (
                            <div className="pt-2 border-t-2 border-black border-dashed">
                              <label className="block text-sm font-medium text-black mb-1">
                                Correct Answer
                              </label>
                              <select
                                value={question.correct_answer || ''}
                                onChange={(e) => handleQuestionFieldChange(index, 'correct_answer', e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200 text-black"
                                disabled={isSaving || isDeleting || isUploading}
                              >
                                <option value="">Select correct answer</option>
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                              </select>
                            </div>
                          )}

                          {question.question_type === 'short_answer' && (
                            <div className="pt-2 border-t-2 border-black border-dashed">
                              <label className="block text-sm font-medium text-black mb-1">
                                Correct Answer
                              </label>
                              <input
                                type="text"
                                value={question.correct_answer || ''}
                                onChange={(e) => handleQuestionFieldChange(index, 'correct_answer', e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200 text-black"
                                placeholder="Enter the correct answer"
                                disabled={isSaving || isDeleting || isUploading}
                              />
                            </div>
                          )}

                          <div className="flex justify-end pt-4 border-t-2 border-black border-dashed">
                            <button
                              onClick={() => handleSaveQuestion(index)}
                              disabled={isSaving || isDeleting || isUploading}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                              {isSaving ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4" />
                                  Save Question
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Question button below the last question */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleAddQuestion}
                  disabled={questions.length >= 30}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white hover:bg-gray-800 transition-all shadow-md rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-5 h-5" />
                  Add Question {questions.length >= 30 && '(Max 30)'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}