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
    <main className="min-h-screen bg-white flex items-center justify-center p-4 font-oswald">
      <div className="w-full max-w-md">
        <Link 
          href="/"
          className="flex items-center justify-center gap-2 text-black font-extrabold text-4xl mb-8 hover:text-gray-800 transition-colors font-oswald"
        >
          hayolo.io
        </Link>

        <div className="bg-white p-8 rounded-lg shadow-lg border-2 border-black font-oswald">
          <h1 className="text-2xl font-extrabold text-black mb-2 text-center font-oswald">Welcome Back</h1>
          <p className="text-gray-700 text-center mb-8 font-oswald">Sign in to your account to continue</p>
          
          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-black rounded-lg text-black bg-white hover:bg-gray-100 transition-all duration-200 mb-6 shadow-sm font-oswald"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              <div className="w-full border-t-2 border-black border-dashed"></div>
            </div>
            <div className="relative flex justify-center text-sm font-oswald">
              <span className="px-2 bg-white text-gray-700">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 font-oswald">
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-black mb-1 font-oswald">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-white border-2 border-black rounded-lg text-black focus:outline-none focus:ring-0 focus:border-black transition-all shadow-sm font-oswald"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-black mb-1 font-oswald">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-white border-2 border-black rounded-lg text-black focus:outline-none focus:ring-0 focus:border-black transition-all shadow-sm font-oswald"
                required
              />
            </div>

            {error && (
              <div className={
                error.includes('Check your email')
                  ? 'text-green-600 bg-green-50 border border-green-600 p-2 rounded-lg text-sm text-center mt-4 font-oswald'
                  : 'text-red-600 bg-red-50 border border-red-600 p-2 rounded-lg text-sm text-center mt-4 font-oswald'
                } role="alert">
                <div className="flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-2 font-oswald">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 w-full sm:w-auto bg-[#FFD34E] text-black px-4 py-2 rounded-lg font-bold text-sm hover:bg-yellow-500 transition-all border-2 border-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md font-oswald"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" />
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
                className="flex-1 w-full sm:w-auto bg-white text-black px-4 py-2 rounded-lg font-bold text-sm border-2 border-black hover:bg-gray-100 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-oswald"
              >
                Sign Up
              </button>
            </div>
          </form>
        </div>

        <p className="mt-8 text-center text-sm text-gray-700 font-oswald">
          By signing in, you agree to our{' '}
          <Link href="/terms" className="font-bold text-black hover:text-gray-800 transition-colors font-oswald">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="font-bold text-black hover:text-gray-800 transition-colors font-oswald">
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  )
}