// app/create/page.tsx (or wherever your CreateCrosswordPage is located)
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import ConfirmationModal from '@/components/ConfirmationModal'; // Assuming this component is styled separately
import { Play, Presentation, Square, Plus, Trash2, Edit, Eye } from 'lucide-react'; // Added icons for clarity
import toast from 'react-hot-toast';
import ModalLoading from '@/app/components/ModalLoading';

interface CrosswordEntry {
  question: string;
  answer: string;
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

interface Crossword {
  id: string;
  name: string;
  created_at: string;
  entries: CrosswordEntry[];
  session_status?: 'waiting' | 'in_progress' | 'completed' | null; // Added
  session_id?: string | null;   // New: to store the ID of the active session
  session_code?: string | null; // New: to store the code of the active session
}

export default function CreateCrosswordPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [entries, setEntries] = useState<CrosswordEntry[]>([
    { question: '', answer: '' }
  ]);
  const [puzzleName, setPuzzleName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [crosswords, setCrosswords] = useState<Crossword[]>([]);
  const [isFetchingCrosswords, setIsFetchingCrosswords] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [crosswordToDelete, setCrosswordToDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCrosswords, setTotalCrosswords] = useState(0);
  const ITEMS_PER_PAGE = 4;

  const fetchCrosswords = async () => {
    setIsFetchingCrosswords(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error("User not authenticated:", authError);
        router.push('/login');
        return;
      }

      const { count, error: countError } = await supabase
        .from('crosswords')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) throw countError;
      setTotalCrosswords(count || 0);

      const { data: crosswordsData, error: crosswordsError } = await supabase
        .from('crosswords')
        .select('id, name, created_at, entries')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      if (crosswordsError) throw crosswordsError;

      if (!crosswordsData || crosswordsData.length === 0) {
        setCrosswords([]);
        return;
      }

      const crosswordIds = crosswordsData.map(c => c.id);

      let sessionsMap: Map<string, { id: string, status: 'waiting' | 'in_progress' | 'completed', code: string }> = new Map();

      if (crosswordIds.length > 0) {
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('present_sessions')
          .select('id, content_id, status, code')
          .in('content_id', crosswordIds)
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

      const finalCrosswords = crosswordsData.map(crossword => {
        const activeSession = sessionsMap.get(crossword.id);
        return {
          ...crossword,
          session_status: activeSession ? activeSession.status : null,
          session_id: activeSession ? activeSession.id : null,
          session_code: activeSession ? activeSession.code : null,
        };
      });

      // console.log(finalCrosswords);
      setCrosswords(finalCrosswords);

    } catch (error) {
      console.error('Error fetching crosswords:', error);
    } finally {
      setIsFetchingCrosswords(false);
    }
  };

  useEffect(() => {
    fetchCrosswords();
  }, [currentPage, supabase, router]);

  const totalPages = Math.ceil(totalCrosswords / ITEMS_PER_PAGE);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const addEntry = () => {
    if (entries.length < 10) {
      setEntries([...entries, { question: '', answer: '' }]);
    }
  };

  const removeEntry = (index: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== index));
    }
  };

  const updateEntry = (index: number, field: keyof CrosswordEntry, value: string) => {
    const updated = entries.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    );
    setEntries(updated);
  };

  const handleEditCrossword = (crossword: Crossword) => {
    setPuzzleName(crossword.name);
    setEntries(crossword.entries);
    setIsEditing(true);
    setEditingId(crossword.id);
    document.getElementById('puzzle-info')?.scrollIntoView({ behavior: 'smooth' });
  };

  const generateAndSavePuzzle = async () => {
    const validEntries = entries.filter(entry => entry.question.trim() && entry.answer.trim());
    if (validEntries.length < 2) {
      alert('Please add at least 2 complete question-answer pairs to create a crossword.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    setIsLoading(true);
    try {
      // --- DYNAMIC GRID SIZE CALCULATION ---
      // 1. Find the length of the longest answer
      const longestAnswerLength = validEntries.reduce((max, entry) =>
        Math.max(max, entry.answer.trim().length), 0
      );

      // 2. Determine base grid size (at least 15)
      let dynamicGridSize = Math.max(15, longestAnswerLength + 2); // +2 for padding on sides
                                                                // You might need more padding depending on your specific algorithm's needs.
                                                                // E.g., if words can start near the edge.

      // 3. Ensure a reasonable maximum to prevent excessively large grids
      if (dynamicGridSize > 30) { // Set a practical upper limit, e.g., 30x30
          dynamicGridSize = 30;
          toast.error("Puzzle grid size adjusted to max 30x30 for performance.");
      }

      const gridSize = dynamicGridSize; // Use the dynamically calculated size from here on

      // --- GRID INITIALIZATION (using the calculated gridSize) ---
      const grid: GridCell[][] = Array(gridSize).fill(null).map(() =>
        Array(gridSize).fill(null).map(() => ({
          letter: '',
          isBlack: true,
          belongsToWords: [],
          number: undefined
        }))
      );

      const placedWords: PlacedWord[] = [];
      let currentNumber = 1;
      // Sort words by length descending to prioritize placing longer words first
      // This often leads to better puzzle generation success rates.
      let unplacedWords = [...validEntries].sort((a, b) => b.answer.length - a.answer.length);

      // --- PLACE FIRST WORD (Now based on the longest word) ---
      // Use the *actual* longest word from sorted unplacedWords as the first one
      const firstEntry = unplacedWords.shift(); // Remove the first (longest) word
      if (!firstEntry) { // Should not happen if validEntries.length >= 2
          throw new Error("No valid first entry to place.");
      }
      const firstWord = firstEntry.answer.toUpperCase();

      // Place first word roughly in the center, accounting for its length
      const startRow = Math.floor(gridSize / 2);
      const startCol = Math.floor((gridSize - firstWord.length) / 2);

      placedWords.push({
        word: firstWord,
        question: firstEntry.question,
        row: startRow,
        col: startCol,
        direction: 'horizontal',
        number: currentNumber
      });

      for (let i = 0; i < firstWord.length; i++) {
        grid[startRow][startCol + i] = {
          letter: firstWord[i],
          isBlack: false,
          number: i === 0 ? currentNumber : undefined,
          belongsToWords: [currentNumber]
        };
      }
      currentNumber++; // Increment after placing the first word

      // --- TRY TO PLACE REMAINING WORDS (Adjusted for dynamic sizing and robustness) ---
      let maxAttempts = 100; // Increased attempts for potentially larger grids/more words
      let iterationAttempts = 0; // Attempts for the current iteration of placing words
      let lastUnplacedCount = unplacedWords.length + 1; // To detect if no words were placed in an iteration

      // Keep trying to place words until all are placed or max attempts reached
      while (unplacedWords.length > 0 && iterationAttempts < maxAttempts) {
          iterationAttempts++;

          let wordsPlacedInThisIteration = false;
          // Shuffle unplaced words to introduce randomness and try different orders
          unplacedWords.sort(() => Math.random() - 0.5);

          for (let i = 0; i < unplacedWords.length; i++) {
              const currentWordEntry = unplacedWords[i];
              const currentWord = currentWordEntry.answer.toUpperCase();
              let bestPlacement: PlacedWord | null = null;
              let bestScore = -1;

              for (const placedExistingWord of placedWords) {
                  for (let placedCharIndex = 0; placedCharIndex < placedExistingWord.word.length; placedCharIndex++) {
                      for (let currentCharIndex = 0; currentCharIndex < currentWord.length; currentCharIndex++) {
                          if (placedExistingWord.word[placedCharIndex] === currentWord[currentCharIndex]) {
                              const newDirection = placedExistingWord.direction === 'horizontal' ? 'vertical' : 'horizontal';

                              let newRow, newCol;
                              if (newDirection === 'horizontal') {
                                  newRow = placedExistingWord.row + (placedExistingWord.direction === 'vertical' ? placedCharIndex : 0);
                                  newCol = placedExistingWord.col - currentCharIndex + (placedExistingWord.direction === 'horizontal' ? placedCharIndex : 0);
                              } else { // newDirection === 'vertical'
                                  newRow = placedExistingWord.row - currentCharIndex + (placedExistingWord.direction === 'vertical' ? placedCharIndex : 0);
                                  newCol = placedExistingWord.col + (placedExistingWord.direction === 'horizontal' ? placedCharIndex : 0);
                              }

                              // Check placement validity
                              if (isValidPlacement(grid, currentWord, newRow, newCol, newDirection, gridSize)) {
                                  const score = calculatePlacementScore(grid, currentWord, newRow, newCol, newDirection);
                                  if (score > bestScore) {
                                      bestScore = score;
                                      bestPlacement = {
                                          word: currentWord,
                                          question: currentWordEntry.question,
                                          row: newRow,
                                          col: newCol,
                                          direction: newDirection,
                                          number: 0 // Temporary
                                      };
                                  }
                              }
                          }
                      }
                  }
              }

              if (bestPlacement) {
                  // Assign a number (this needs to be unique and managed)
                  while (placedWords.some(w => w.number === currentNumber)) {
                      currentNumber++;
                  }
                  bestPlacement.number = currentNumber;

                  // Temporarily place to see if it allows other words to be placed better
                  // For a more advanced algorithm, you'd implement full backtracking here.
                  // For simplicity here, we commit immediately.
                  placedWords.push(bestPlacement);
                  placeWordInGrid(grid, bestPlacement);
                  currentNumber++;
                  
                  // Remove the successfully placed word from unplacedWords
                  unplacedWords.splice(i, 1);
                  i--; // Adjust index since we removed an item
                  wordsPlacedInThisIteration = true;
              }
          }

          // If no words were placed in this entire iteration (and unplaced words still exist),
          // or if we're stuck (unplacedCount hasn't changed), try a different approach (re-shuffling, etc.)
          if (!wordsPlacedInThisIteration && unplacedWords.length > 0) {
              // This indicates a difficult placement scenario.
              // Reset and retry from scratch with a different initial configuration.
              // This is a simple form of "backtracking" for a fixed number of attempts.
              // A more sophisticated algorithm would selectively backtrack last placement.

              if (iterationAttempts < maxAttempts - 1) { // Only reset if we still have attempts left
                   // Reset grid, placed words, and unplaced words
                  for (let row = 0; row < gridSize; row++) {
                      for (let col = 0; col < gridSize; col++) {
                          grid[row][col] = {
                              letter: '',
                              isBlack: true,
                              belongsToWords: [],
                              number: undefined
                          };
                      }
                  }
                  placedWords.length = 0; // Clear array
                  currentNumber = 1;
                  unplacedWords = [...validEntries].sort((a, b) => Math.random() - 0.5); // Reshuffle all entries

                  // Place a new first word (e.g., the new longest or a random one)
                  const newFirstEntry = unplacedWords.shift();
                  if (newFirstEntry) {
                      const newFirstWord = newFirstEntry.answer.toUpperCase();
                      const newStartRow = Math.floor(gridSize / 2); // Or randomly pick starting point
                      const newStartCol = Math.floor((gridSize - newFirstWord.length) / 2);

                      placedWords.push({
                          word: newFirstWord,
                          question: newFirstEntry.question,
                          row: newStartRow,
                          col: newStartCol,
                          direction: 'horizontal', // Could also randomize direction
                          number: currentNumber
                      });

                      for (let i = 0; i < newFirstWord.length; i++) {
                          grid[newStartRow][newStartCol + i] = {
                              letter: newFirstWord[i],
                              isBlack: false,
                              number: i === 0 ? currentNumber : undefined,
                              belongsToWords: [currentNumber]
                          };
                      }
                      currentNumber++;
                      iterationAttempts = 0; // Reset attempts for this new configuration
                  } else {
                      // This means unplacedWords became empty after a previous shift, which is good
                      break;
                  }
              }
          }
          lastUnplacedCount = unplacedWords.length;
      }

      // --- FINAL VALIDATION AND NUMBERING ---
      if (unplacedWords.length > 0) {
        throw new Error(`Could not place all words in the grid after ${maxAttempts} attempts. Unplaced words: ${unplacedWords.map(w => w.answer).join(', ')}`);
      }

      const finalPlacedWords: PlacedWord[] = [];
      const usedNumbers = new Set<number>();
      currentNumber = 1;

      // Reset all numbers in the grid cells first
      for (let row = 0; row < gridSize; row++) {
          for (let col = 0; col < gridSize; col++) {
              if (grid[row][col] && !grid[row][col].isBlack) { // Ensure cell exists and is not black
                  grid[row][col].number = undefined;
              }
          }
      }

      // Assign final numbers based on the earliest starting position of each placed word
      // Sort placed words by their position to assign numbers consistently (top-to-bottom, left-to-right)
      placedWords.sort((a, b) => {
          if (a.row !== b.row) return a.row - b.row;
          return a.col - b.col;
      });

      // Re-number and update belongsToWords based on final numbering
      placedWords.forEach(word => {
          const { row, col } = word;

          // Assign new sequential number
          const assignedNumber = currentNumber;
          currentNumber++;

          // Update the grid cell at the start of the word
          if (grid[row][col]) { // Ensure cell exists
              grid[row][col].number = assignedNumber;
          }

          // Create the final PlacedWord object with the assigned number
          finalPlacedWords.push({
              ...word,
              number: assignedNumber
          });

          // Update belongsToWords for all cells occupied by this word with the new number
          for (let i = 0; i < word.word.length; i++) {
              const r = word.direction === 'horizontal' ? row : row + i;
              const c = word.direction === 'horizontal' ? col + i : col;
              if (grid[r][c]) { // Ensure cell exists
                  // Filter out old numbers and add the new one
                  grid[r][c].belongsToWords = grid[r][c].belongsToWords
                      .filter(n => n !== word.number) // Remove old temp number if any
                      .concat(assignedNumber)
                      .filter((value, index, self) => self.indexOf(value) === index); // Ensure uniqueness
              }
          }
      });

      // Sort finalPlacedWords by number for consistent display in clues
      finalPlacedWords.sort((a, b) => a.number - b.number);


      // --- DATABASE SAVE / UPDATE ---
      if (isEditing && editingId) {
        const { error } = await supabase
          .from('crosswords')
          .update({
            name: puzzleName || 'Untitled Puzzle',
            entries: validEntries,
            grid: grid, // Update grid for edited puzzles
            placed_words: finalPlacedWords, // Update placed_words
          })
          .eq('id', editingId);

        if (error) throw error;

        toast.success('Puzzle updated successfully!');
      }
      else {
        const { data, error } = await supabase
          .from('crosswords')
          .insert([
            {
              name: puzzleName || 'Untitled Puzzle',
              entries: validEntries,
              grid: grid,
              placed_words: finalPlacedWords,
              created_at: new Date().toISOString(),
              user_id: user.id
            }
          ])
          .select('id')
          .single();

        if (error) throw error;

        toast.success('Puzzle created successfully!');
      }

      // --- RESET UI AND REFETCH ---
      setIsEditing(false);
      setEditingId(null);
      setPuzzleName('');
      setEntries([{ question: '', answer: '' }]);
      fetchCrosswords(); // Re-fetch list to show updated/new puzzle
      document.getElementById('my-puzzles')?.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
      console.error('Error saving puzzle:', error);
      toast.error(`Failed to save the puzzle: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ... (your isValidPlacement, calculatePlacementScore, placeWordInGrid functions - these need to be robust)
  // Note: Ensure isValidPlacement and calculatePlacementScore handle grid boundaries correctly with the dynamic gridSize.
  // The provided isValidPlacement seems to include some boundary checks, but double-check them thoroughly.

  const isValidPlacement = (grid: any[][], word: string, row: number, col: number, direction: 'horizontal' | 'vertical', gridSize: number): boolean => {
    if (direction === 'horizontal') {
      if (col < 0 || col + word.length > gridSize || row < 0 || row >= gridSize) return false;
    } else {
      if (row < 0 || row + word.length > gridSize || col < 0 || col >= gridSize) return false;
    }

    if (direction === 'horizontal') {
      if (col > 0 && !grid[row][col - 1].isBlack) return false;
      if (col + word.length < gridSize && !grid[row][col + word.length].isBlack) return false;

      for (let i = 0; i < word.length; i++) {
        if (!grid[row][col + i].isBlack && grid[row][col + i].letter !== word[i]) return false;

        if (row > 0 && !grid[row - 1][col + i].isBlack) {
          let isPartOfCrossing = false;
          if (grid[row][col + i].letter === word[i] || grid[row][col + i].isBlack) {
            isPartOfCrossing = true;
          }
          if (!isPartOfCrossing) return false;
        }
        if (row < gridSize - 1 && !grid[row + 1][col + i].isBlack) {
          let isPartOfCrossing = false;
          if (grid[row][col + i].letter === word[i] || grid[row][col + i].isBlack) {
            isPartOfCrossing = true;
          }
          if (!isPartOfCrossing) return false;
        }
      }
    } else {
      if (row > 0 && !grid[row - 1][col].isBlack) return false;
      if (row + word.length < gridSize && !grid[row + word.length][col].isBlack) return false;

      for (let i = 0; i < word.length; i++) {
        if (!grid[row + i][col].isBlack && grid[row + i][col].letter !== word[i]) return false;

        if (col > 0 && !grid[row + i][col - 1].isBlack) {
          let isPartOfCrossing = false;
          if (grid[row + i][col].letter === word[i] || grid[row + i][col].isBlack) {
            isPartOfCrossing = true;
          }
          if (!isPartOfCrossing) return false;
        }
        if (col < gridSize - 1 && !grid[row + i][col + 1].isBlack) {
          let isPartOfCrossing = false;
          if (grid[row + i][col].letter === word[i] || grid[row + i][col].isBlack) {
            isPartOfCrossing = true;
          }
          if (!isPartOfCrossing) return false;
        }
      }
    }

    return true;
  };

  const calculatePlacementScore = (grid: any[][], word: string, row: number, col: number, direction: 'horizontal' | 'vertical'): number => {
    let score = 0;

    for (let i = 0; i < word.length; i++) {
      const currentRow = direction === 'horizontal' ? row : row + i;
      const currentCol = direction === 'horizontal' ? col + i : col;

      if (grid[currentRow][currentCol].letter === word[i]) {
        score += 10;
      }
    }

    return score;
  };

  const placeWordInGrid = (grid: any[][], placement: PlacedWord) => {
    for (let i = 0; i < placement.word.length; i++) {
      const row = placement.direction === 'horizontal' ? placement.row : placement.row + i;
      const col = placement.direction === 'horizontal' ? placement.col + i : placement.col;

      grid[row][col] = {
        letter: placement.word[i],
        isBlack: false,
        number: i === 0 ? placement.number : grid[row][col].number,
        belongsToWords: [...(grid[row][col].belongsToWords || []), placement.number]
      };
    }
  };

  const handleDeleteClick = (crosswordId: string) => {
    setCrosswordToDelete(crosswordId);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!crosswordToDelete) return;

    setIsLoading(true);
    setIsDeleting(true);
    setDeletingId(crosswordToDelete);

    try {
      const { error } = await supabase
        .from('crosswords')
        .delete()
        .eq('id', crosswordToDelete);

      if (error) throw error;

      fetchCrosswords();
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting crossword:', error);
      alert('Failed to delete the crossword. Please try again.');
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
      setCrosswordToDelete(null);
      setIsLoading(false);
    }
  };

  const handleStopSession = async (crosswordData: Crossword) => {
    if (!crosswordData.session_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('present_sessions')
        .update({ status: 'completed' })
        .eq('id', crosswordData.session_id)
        .select();

      if (error) throw error;

      if (data) {
        toast.success(`Session for ${crosswordData.name} stopped`);
        fetchCrosswords();
      }
    } catch (error) {
      console.error('Error stopping session:', error);
      alert('Failed to stop the session. Please try again.');
    } finally {
      setIsLoading(false);
      // setIsStopping(false);
      // setStoppingId(null);
    }
  }

  const handlePresentCrossword = async (crossword: Crossword) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: newSession, error: joinError } = await supabase
        .rpc('create_crossword_session', {
          p_content_id: crossword.id,
          p_session_type: 'crossword',
          p_user_id: user.id,
          // p_code: params.code
        });

      if (joinError) throw joinError;

      toast.success('Puzzle created successfully!');

      router.push(`/waiting-room/host/${crossword.id}/${newSession[0].session_code}`);
    } catch (error) {
      console.error('Error joining present session:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const canAddMore = entries.length < 10;
  const hasValidEntries = entries.some(entry => entry.question.trim() && entry.answer.trim());

  return (
    <>
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setCrosswordToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Crossword"
        message="Are you sure you want to delete this crossword? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
      {/* Crossword Creator Title */}
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-4xl font-extrabold text-black mb-2">Crossword Creator</h1>
        <p className="text-gray-700 text-xl mb-4">Design your own crossword puzzle with up to 10 clues</p>
      </div>

      {/* My Crosswords Section */}
      <div className="bg-white rounded-lg shadow p-6 border-2 border-black mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-black">My Crosswords</h2>
            <p className="text-sm text-gray-500 mt-1">Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalCrosswords)} of {totalCrosswords} puzzles</p>
          </div>
          <button
            onClick={() => {
              setIsEditing(false);
              setEditingId(null);
              setPuzzleName('');
              setEntries([{ question: '', answer: '' }]);
              document.getElementById('puzzle-info')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-4 py-2 rounded-full border-2 border-black text-black bg-[#FFD34E] hover:bg-yellow-300 transition-all duration-200 flex items-center justify-center font-bold"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create New
          </button>
        </div>

        {isFetchingCrosswords ? (
          <div className="flex justify-center items-center min-h-[200px]">
            <div className="animate-spin rounded-none h-8 w-8 border-2 border-black"></div>
          </div>
        ) : crosswords.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-none border-2 border-dashed border-black shadow-lg">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-none bg-gray-100 mb-4 border-2 border-black">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-black mb-2">No Crosswords Yet</h3>
          <p className="text-gray-700 mb-6">Create your first crossword puzzle to get started!</p>
          <button
            onClick={() => document.getElementById('puzzle-info')?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white hover:bg-gray-800 transition-all shadow-md rounded-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Your First Puzzle
          </button>
        </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {crosswords.map((crossword) => (
                <div
                  key={crossword.id}
                  className="group relative bg-white rounded-xl border-dashed border-black shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border-2"
                >
                  <div className="absolute top-0 right-0 mt-4 mr-4 z-10"> {/* Added z-index for visibility */}
                    <button
                      onClick={() => handleDeleteClick(crossword.id)}
                      disabled={isDeleting && deletingId === crossword.id}
                      className="inline-flex items-center justify-center w-10 h-10 rounded-none border border-black text-black hover:bg-gray-100 transition-all disabled:opacity-50"
                    >
                      {isDeleting && deletingId === crossword.id ? (
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
                      {crossword.name}
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-none text-xs font-medium bg-gray-100 text-black border border-black">
                        {crossword.entries.length} clues
                      </span>
                    </h3>
                    <p className="text-sm text-gray-500 mt-2">
                      Created {new Date(crossword.created_at).toLocaleDateString()}
                    </p>

                    <div className="mt-6 flex items-center gap-3">
                    {
                      crossword.session_status !== null ? (
                        <>
                          <button
                            onClick={() => handleStopSession(crossword)}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-full !p-0 flex-none
                                        bg-black text-white hover:bg-gray-800 transition-colors shadow-sm"
                          >
                            <Square className="w-4 h-4" />
                          </button>
                          {crossword.session_status === 'waiting' && (
                            <Link
                              href={`/waiting-room/host/${crossword.id}/${crossword.session_code}`}
                              target="_blank"
                              className="inline-flex items-center justify-center w-10 h-10 rounded-full !p-0 flex-none
                                          bg-black text-white hover:bg-gray-800 transition-colors shadow-sm"
                            >
                              <Presentation className="w-4 h-4" />
                            </Link>
                          )}
                          {/* If status is 'in_progress', maybe show a link to view the game */}
                          {crossword.session_status === 'in_progress' && (
                            <Link
                              target="_blank"
                              href={`/crossword/${crossword.id}/${crossword.session_code}`} 
                              className="inline-flex items-center justify-center w-10 h-10 rounded-full !p-0 flex-none
                                          bg-black text-white hover:bg-gray-800 transition-colors shadow-sm"
                            >
                              <Eye className="w-4 h-4" /> {/* Eye icon to view game */}
                            </Link>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => handlePresentCrossword(crossword)}
                          className="inline-flex items-center justify-center w-10 h-10 rounded-full !p-0 flex-none
                                      bg-black text-white hover:bg-gray-800 transition-colors shadow-sm"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )
                    }
                      <Link
                        href={`/dashboard/crossword-puzzle/${crossword.id}`}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-black text-sm font-medium rounded-lg hover:bg-gray-50 transition-all text-black"
                      >
                        <Eye className="w-4 h-4" />
                        Details
                      </Link>
                      <button
                        onClick={() => handleEditCrossword(crossword)}
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

            {/* Pagination Controls */}
            <div className="mt-6 flex items-center justify-between border-t-2 border-black bg-white px-4 py-3 sm:px-6">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-md border-2 border-black bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  className="relative ml-3 inline-flex items-center rounded-md border-2 border-black bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-black">
                    Page <span className="font-medium">{currentPage}</span> of{' '}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-md border-2 border-black bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Previous
                  </button>
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages}
                    className="relative inline-flex items-center rounded-md border-2 border-black bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div id="puzzle-info" className="mb-6 bg-white shadow-lg p-6 border-2 border-black rounded-lg">
        <h2 className="text-xl font-semibold text-black mb-4">
          {isEditing ? 'Edit Puzzle' : 'Create New Puzzle'}
        </h2>
        <div className="space-y-2">
          <label htmlFor="puzzleName" className="block text-sm font-medium text-black">
            Puzzle Name
          </label>
          <input
            type="text"
            id="puzzleName"
            placeholder="Enter a name for your crossword puzzle..."
            value={puzzleName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPuzzleName(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200 text-black"
          />
        </div>
      </div>

      <div className="bg-white shadow-lg p-6 border-2 border-black rounded-lg">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-black mb-2">Questions & Answers</h2>
          <p className="text-gray-600">
            Add your crossword clues and their corresponding answers. Answers will be placed in the grid.
          </p>
        </div>

        <div className="space-y-4">
          {entries.map((entry, index) => (
            <div key={index} className="p-4 border-2 border-black border-dashed rounded-lg bg-gray-50/50 transition-all duration-200 hover:bg-gray-100">
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-medium text-black bg-gray-100 px-2 py-1 rounded-md border-2 border-black">
                  Entry {index + 1}
                </span>
                {entries.length > 1 && (
                  <button
                    onClick={() => removeEntry(index)}
                    className="text-black hover:text-gray-700 hover:bg-gray-100 p-1 rounded-full transition-colors duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-black">Question/Clue</label>
                  <textarea
                    placeholder="Enter your crossword clue..."
                    value={entry.question}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateEntry(index, 'question', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-1 focus:ring-black min-h-[80px] transition-all duration-200 text-black"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-black">Answer</label>
                  <input
                    type="text"
                    placeholder="Enter the answer (letters only)..."
                    value={entry.answer}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEntry(index, 'answer', e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                    className="w-full px-4 py-2 rounded-lg border-2 border-black focus:outline-none focus:ring-1 focus:ring-black transition-all duration-200 text-black"
                  />
                  {entry.answer && (
                    <p className="text-xs text-gray-500">
                      Length: {entry.answer.length} letters
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={addEntry}
              disabled={!canAddMore}
              className="flex-1 px-4 py-2 rounded-lg border-2 border-black text-black hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Entry {!canAddMore && '(Max 10)'}
            </button>

            <button
              onClick={generateAndSavePuzzle}
              disabled={!hasValidEntries || isLoading}
              className="flex-1 px-4 py-2 rounded-lg text-white font-medium bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                {isEditing ? (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Update & Play Crossword
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Create & Play Crossword
                  </>
                )}
                </>
              )}
            </button>
          </div>

          <div className="text-center pt-4">
            <p className="text-sm text-gray-500">
              {entries.filter(e => e.question.trim() && e.answer.trim()).length} of {entries.length} entries completed
            </p>
          </div>
        </div>
      </div>
      <ModalLoading isOpen={isLoading} />
    </>
  );
}