// app/login/page.tsx
'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Loader2 } from 'lucide-react'; // Added Lucide icons for error/loading

export default function Login() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Redirect to dashboard after successful login
      router.push('/dashboard')
      router.refresh()
    } catch (error: any) { // Use any for error type if not strictly Error object
      // Provide more user-friendly messages for common errors
      if (error.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Please confirm your email address to sign in.');
      } else {
        setError(error.message || 'An unexpected error occurred during login');
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError(null); // Clear previous errors
    setIsLoading(true); // Indicate loading for Google login
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      if (error) throw error
      // No need for router.push/refresh here, OAuth callback handles redirect
    } catch (error: any) {
      setError(error.message || 'An error occurred during Google login');
    } finally {
        setIsLoading(false); // Stop loading after Google login attempt
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error

      if (data.user) {
        setError('Success! Please check your email for the confirmation link to sign in.');
      } else {
        // This case can happen if signup is successful but no user object is returned immediately
        setError('Signed up successfully! Check your email for the confirmation link.');
      }
      
    } catch (error: any) {
      // More specific error handling for common signup issues
      if (error.message.includes('User already registered')) {
        setError('This email is already registered. Please sign in or use a different email.');
      } else if (error.message.includes('Password should be at least 6 characters')) {
        setError('Password must be at least 6 characters long.');
      } else {
        setError(error.message || 'An unexpected error occurred during sign up');
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-4"> {/* Changed background gradient to solid white */}
      <div className="w-full max-w-md">
        <Link 
          href="/"
          className="flex items-center justify-center gap-2 text-black font-bold text-xl mb-8 hover:text-gray-800 transition-colors" /* Redesigned logo link */
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
          </svg>
          QuestionBoard
        </Link>

        <div className="bg-white p-8 rounded-none shadow-lg border-2 border-black"> {/* Redesigned card container */}
          <h1 className="text-2xl font-bold text-black mb-2 text-center">Welcome Back</h1> {/* Redesigned text */}
          <p className="text-gray-700 text-center mb-8">Sign in to your account to continue</p> {/* Redesigned text */}
          
          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-black rounded-none text-black bg-white hover:bg-gray-100 transition-all duration-200 mb-6 shadow-sm" /* Redesigned button */
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24"> {/* Google icon SVG - kept color for brand recognition */}
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-black border-dashed"></div> {/* Redesigned divider */}
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-700">Or continue with email</span> {/* Redesigned text */}
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-black mb-1"> {/* Redesigned text */}
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-white border-2 border-black rounded-none text-black focus:outline-none focus:ring-0 focus:border-black transition-all shadow-sm" /* Redesigned input */
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-black mb-1"> {/* Redesigned text */}
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-white border-2 border-black rounded-none text-black focus:outline-none focus:ring-0 focus:border-black transition-all shadow-sm" /* Redesigned input */
                required
              />
            </div>

            {error && (
              <div className={
                error.includes('Check your email')
                  ? 'text-green-600 bg-green-50 border border-green-600 p-2 rounded-none text-sm text-center mt-4'
                  : 'text-red-600 bg-red-50 border border-red-600 p-2 rounded-none text-sm text-center mt-4'
                } role="alert">
                <div className="flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {/* Lucide AlertCircle */}
                    <span>{error}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-2"> {/* Stack buttons on mobile */}
              <button
                type="submit"
                disabled={isLoading}
                className={`
                  flex-1 w-full sm:w-auto bg-black text-white px-4 py-2 rounded-none
                  font-medium text-sm
                  hover:bg-gray-800 transition-all border border-black
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2 shadow-md
                `} /* Redesigned primary button */
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" /> {/* Lucide Loader2 */}
                    Processing...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>

              <button
                type="button"
                onClick={handleSignUp}
                disabled={isLoading}
                className={`
                  flex-1 w-full sm:w-auto bg-white text-black px-4 py-2 rounded-none
                  font-medium text-sm border-2 border-black
                  hover:bg-gray-100 transition-all shadow-sm
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2
                `} /* Redesigned secondary button */
              >
                Sign Up
              </button>
            </div>
          </form>
        </div>

        <p className="mt-8 text-center text-sm text-gray-700"> {/* Redesigned text */}
          By signing in, you agree to our{' '}
          <Link href="/terms" className="font-medium text-black hover:text-gray-800 transition-colors"> {/* Redesigned links */}
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="font-medium text-black hover:text-gray-800 transition-colors"> {/* Redesigned links */}
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  )
}