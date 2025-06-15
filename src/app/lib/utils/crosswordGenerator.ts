import { CrosswordClue, CrosswordCell } from '../types/crossword';

const MAX_GRID_SIZE = 20;

interface PlacementAttempt {
  clue: CrosswordClue;
  success: boolean;
  conflicts: boolean;
}

export function generateCrosswordGrid(clues: Omit<CrosswordClue, 'startX' | 'startY' | 'direction' | 'id'>[]): {
  placedClues: CrosswordClue[];
  gridSize: { width: number; height: number };
} {
  const MAX_ATTEMPTS = 100;
  let bestLayout: CrosswordClue[] = [];
  let bestScore = 0;
  
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const shuffledClues = [...clues]
      .map(clue => ({ ...clue }))
      .sort(() => Math.random() - 0.5);
    
    const layout = tryPlacingClues(shuffledClues);
    const score = calculateLayoutScore(layout);
    
    if (score > bestScore) {
      bestScore = score;
      bestLayout = layout;
    }
  }
  
  const gridSize = calculateGridSize(bestLayout);
  return { placedClues: bestLayout, gridSize };
}

function tryPlacingClues(clues: Omit<CrosswordClue, 'startX' | 'startY' | 'direction' | 'id'>[]): CrosswordClue[] {
  const placedClues: CrosswordClue[] = [];
  let nextId = 1;

  // Place first word horizontally in the middle
  const firstWord = {
    ...clues[0],
    id: nextId++,
    startX: 5,
    startY: 5,
    direction: 'across' as const,
  };
  placedClues.push(firstWord);

  // Try to place remaining words
  for (let i = 1; i < clues.length; i++) {
    const currentWord = clues[i];
    let placed = false;

    // Try to intersect with each placed word
    for (const placedWord of placedClues) {
      const intersections = findIntersections(currentWord.answer, placedWord);
      
      for (const intersection of intersections) {
        const newDirection = placedWord.direction === 'across' ? 'down' : 'across';
        const { x, y } = calculateStartPosition(placedWord, intersection, newDirection);
        
        if (isValidPlacement(x, y, currentWord.answer, newDirection, placedClues)) {
          placedClues.push({
            ...currentWord,
            id: nextId++,
            startX: x,
            startY: y,
            direction: newDirection,
          });
          placed = true;
          break;
        }
      }
      
      if (placed) break;
    }
  }

  return placedClues;
}

function findIntersections(word: string, placedWord: CrosswordClue): { wordIndex: number; placedIndex: number }[] {
  const intersections: { wordIndex: number; placedIndex: number }[] = [];
  
  for (let i = 0; i < word.length; i++) {
    for (let j = 0; j < placedWord.answer.length; j++) {
      if (word[i].toLowerCase() === placedWord.answer[j].toLowerCase()) {
        intersections.push({ wordIndex: i, placedIndex: j });
      }
    }
  }
  
  return intersections;
}

function calculateStartPosition(
  placedWord: CrosswordClue,
  intersection: { wordIndex: number; placedIndex: number },
  newDirection: 'across' | 'down',
): { x: number; y: number } {
  if (newDirection === 'across') {
    return {
      x: placedWord.startX - intersection.wordIndex,
      y: placedWord.startY + intersection.placedIndex,
    };
  } else {
    return {
      x: placedWord.startX + intersection.placedIndex,
      y: placedWord.startY - intersection.wordIndex,
    };
  }
}

function isValidPlacement(
  startX: number,
  startY: number,
  word: string,
  direction: 'across' | 'down',
  placedWords: CrosswordClue[],
): boolean {
  // Check boundaries
  if (startX < 0 || startY < 0 || startX >= MAX_GRID_SIZE || startY >= MAX_GRID_SIZE) {
    return false;
  }

  // Check for collisions
  for (let i = 0; i < word.length; i++) {
    const x = direction === 'across' ? startX + i : startX;
    const y = direction === 'down' ? startY + i : startY;
    
    for (const placedWord of placedWords) {
      if (hasCollision(x, y, placedWord)) {
        return false;
      }
    }
  }

  return true;
}

function hasCollision(x: number, y: number, placedWord: CrosswordClue): boolean {
  const wordLength = placedWord.answer.length;
  
  for (let i = 0; i < wordLength; i++) {
    const wx = placedWord.direction === 'across' ? placedWord.startX + i : placedWord.startX;
    const wy = placedWord.direction === 'down' ? placedWord.startY + i : placedWord.startY;
    
    if (wx === x && wy === y) {
      return true;
    }
  }
  
  return false;
}

function calculateLayoutScore(layout: CrosswordClue[]): number {
  let score = 0;
  
  // More intersections = better score
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      const intersections = findIntersections(layout[i].answer, layout[j]);
      score += intersections.length;
    }
  }
  
  return score;
}

function calculateGridSize(layout: CrosswordClue[]): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;
  
  for (const clue of layout) {
    const endX = clue.direction === 'across' ? clue.startX + clue.answer.length - 1 : clue.startX;
    const endY = clue.direction === 'down' ? clue.startY + clue.answer.length - 1 : clue.startY;
    
    maxX = Math.max(maxX, endX);
    maxY = Math.max(maxY, endY);
  }
  
  return {
    width: maxX + 2, // Add padding
    height: maxY + 2,
  };
}

export function generateEmptyGrid(width: number, height: number): CrosswordCell[][] {
  const grid: CrosswordCell[][] = [];
  
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) {
      grid[y][x] = {
        x,
        y,
        letter: '',
        isBlank: true,
        clueNumbers: [],
      };
    }
  }
  
  return grid;
}

export function populateGrid(
  grid: CrosswordCell[][],
  clues: CrosswordClue[],
  showAnswers: boolean = false,
): CrosswordCell[][] {
  const newGrid = JSON.parse(JSON.stringify(grid));
  let clueNumber = 1;
  
  for (const clue of clues) {
    const { startX, startY, answer, direction } = clue;
    let numberAdded = false;
    
    for (let i = 0; i < answer.length; i++) {
      const x = direction === 'across' ? startX + i : startX;
      const y = direction === 'down' ? startY + i : startY;
      
      if (y < newGrid.length && x < newGrid[y].length) {
        if (!numberAdded) {
          newGrid[y][x].clueNumbers.push(clueNumber);
          numberAdded = true;
        }
        
        newGrid[y][x].isBlank = false;
        newGrid[y][x].letter = showAnswers ? answer[i].toUpperCase() : '';
      }
    }
    
    clueNumber++;
  }
  
  return newGrid;
} 