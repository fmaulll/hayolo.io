import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export interface Question {
  id: string
  created_at: string
  question: string
  board_id: string
  order: number
  questioned_by: string | null
  spam: boolean
  comments_count?: number
  question_number?: number
  likes_count?: number
}

export interface Board {
  id: string
  title: string
  description: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  created_at: string
  question_id: string
  comment: string
  commented_by: string | null
} 