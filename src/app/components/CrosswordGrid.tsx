'use client';

import { useState, useEffect } from 'react';
import { CrosswordCell, CrosswordClue } from '../lib/types/crossword';
import { generateEmptyGrid, populateGrid } from '../lib/utils/crosswordGenerator';

interface CrosswordGridProps {
  clues: CrosswordClue[];
  gridSize: { width: number; height: number };
  showAnswers?: boolean;
  onCellClick?: (x: number, y: number) => void;
  selectedCell?: { x: number; y: number } | null;
  userAnswers?: { [key: string]: string };
}

export default function CrosswordGrid({
  clues,
  gridSize,
  showAnswers = false,
  onCellClick,
  selectedCell,
  userAnswers = {},
}: CrosswordGridProps) {
  const [grid, setGrid] = useState<CrosswordCell[][]>([]);

  useEffect(() => {
    const emptyGrid = generateEmptyGrid(gridSize.width, gridSize.height);
    const populatedGrid = populateGrid(emptyGrid, clues, showAnswers);
    setGrid(populatedGrid);
  }, [clues, gridSize, showAnswers]);

  const getCellContent = (cell: CrosswordCell) => {
    if (cell.isBlank) return null;

    if (showAnswers) {
      return cell.letter;
    }

    const key = `${cell.x},${cell.y}`;
    return userAnswers[key] || '';
  };

  const isSelected = (x: number, y: number) => {
    return selectedCell?.x === x && selectedCell?.y === y;
  };

  const getClueNumber = (cell: CrosswordCell) => {
    return cell.clueNumbers.length > 0 ? cell.clueNumbers[0] : null;
  };

  if (!grid.length) return null;

  return (
    <div className="inline-block bg-white border border-gray-300 p-2">
      <div className="grid" style={{ 
        display: 'grid',
        gridTemplateColumns: `repeat(${gridSize.width}, 40px)`,
        gap: '1px',
        background: '#000',
      }}>
        {grid.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${x}-${y}`}
              className={`
                relative
                w-10 h-10
                flex items-center justify-center
                text-lg font-bold
                ${cell.isBlank ? 'bg-black' : 'bg-white cursor-pointer hover:bg-blue-50'}
                ${isSelected(x, y) ? 'bg-blue-200 hover:bg-blue-200' : ''}
              `}
              onClick={() => !cell.isBlank && onCellClick?.(x, y)}
            >
              {!cell.isBlank && (
                <>
                  {getClueNumber(cell) && (
                    <span className="absolute top-0 left-0 text-xs font-normal p-0.5">
                      {getClueNumber(cell)}
                    </span>
                  )}
                  <span className={`${isSelected(x, y) ? 'text-blue-800' : 'text-black'}`}>
                    {getCellContent(cell)}
                  </span>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
} 