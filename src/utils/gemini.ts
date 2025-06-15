import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY! })

export async function isSpamQuestion(question: string): Promise<boolean> {
  try {
    const prompt = `You are a spam and inappropriate content detector. Analyze the following question and respond with ONLY "true" if it's spam (contains inappropriate content, bad words, hate speech, adult content, offensive language, or anything negative) or "false" if it's safe and appropriate. Just respond with one word, either "true" or "false".

Question to analyze: "${question}"

Your one-word response (true/false):`

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt
    })
    
    if (!result) return false
    
    const text = result.text
    return text?.toLowerCase().trim() === 'true'
  } catch (error) {
    console.error('Error checking spam with Gemini:', error)
    return false // Default to false if there's an error
  }
} 