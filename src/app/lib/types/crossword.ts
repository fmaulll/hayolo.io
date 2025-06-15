export interface CrosswordClue {
  id: number;
  question: string;
  answer: string;
  direction: 'across' | 'down';
  startX: number;
  startY: number;
}

export interface CrosswordPuzzle {
  id: string;
  title: string;
  clues: CrosswordClue[];
  gridSize: {
    width: number;
    height: number;
  };
  createdAt: string;
}

export interface CrosswordCell {
  x: number;
  y: number;
  letter: string;
  isBlank: boolean;
  clueNumbers: number[];
} 