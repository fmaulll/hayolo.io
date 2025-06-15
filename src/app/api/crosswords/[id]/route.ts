import { NextResponse } from 'next/server';
import { CrosswordPuzzle } from '../../../lib/types/crossword';

// In a real application, this would be fetched from a database
// For now, we'll use the same in-memory storage from the index endpoint
declare const puzzles: CrosswordPuzzle[];

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const puzzle = puzzles.find(p => p.id === params.id);
  
  if (!puzzle) {
    return NextResponse.json({ error: 'Puzzle not found' }, { status: 404 });
  }
  
  return NextResponse.json(puzzle);
} 