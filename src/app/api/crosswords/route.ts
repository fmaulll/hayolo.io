import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { CrosswordPuzzle } from '../../lib/types/crossword';

// In a real application, this would be a database
let puzzles: CrosswordPuzzle[] = [];

export async function POST(request: Request) {
  try {
    const puzzle: Omit<CrosswordPuzzle, 'id'> = await request.json();
    const newPuzzle: CrosswordPuzzle = {
      ...puzzle,
      id: uuidv4(),
    };
    
    puzzles.push(newPuzzle);
    
    return NextResponse.json(newPuzzle, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid puzzle data' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json(puzzles);
} 