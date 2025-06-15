// app/layout.tsx (or wherever your DashboardLayout is located)
'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Menu, X, CreditCard, Settings, LogOut, User, ChevronDown } from 'lucide-react'; // Added Lucide icons for consistency

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClientComponentClient()
  const [userName, setUserName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null) // Use HTMLDivElement

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node) && showMobileMenu) {
        setShowMobileMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMobileMenu]) // Add showMobileMenu to dependencies

  useEffect(() => {
    setShowMobileMenu(false)
    setShowUserMenu(false)
  }, [pathname])

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
          router.push('/login')
          return
        }
        setUserName(user.email?.split('@')[0] || 'Teacher')
      } catch (error) {
        console.error('Error checking auth status:', error)
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }

    checkUser()
  }, [router, supabase.auth])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-none h-12 w-12 border-2 border-black"></div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-white bg-[url('/background-seamless.png')] bg-repeat">
      {/* Header */}
      <header className="bg-white backdrop-blur-sm border-b-2 border-black shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link 
              href="/dashboard"
              className="flex items-center gap-2 text-black font-bold text-xl hover:text-gray-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
              </svg>
              <span className="hidden sm:inline">QuestionBoard</span>
            </Link>

            {/* Mobile menu button */}
            <div className="flex md:hidden">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMobileMenu(!showMobileMenu)
                }}
                className="inline-flex items-center justify-center p-2 rounded-none text-black hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-0 focus:border-none border border-black"
              >
                <span className="sr-only">Open main menu</span>
                {!showMobileMenu ? (
                  <Menu className="block h-6 w-6" /> // Lucide Menu icon
                ) : (
                  <X className="block h-6 w-6" /> // Lucide X icon
                )}
              </button>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <nav className="flex items-center gap-6">
                <Link 
                  href="/dashboard"
                  className={`font-medium transition-colors ${pathname === '/dashboard' ? 'text-black border-b-2 border-black pb-1' : 'text-gray-700 hover:text-black'}`}
                >
                  Home
                </Link>
                <div className="h-6 w-px bg-black"></div> {/* Solid black divider */}
                <Link 
                  href="/dashboard/anonymous-question"
                  className={`font-medium transition-colors ${pathname.includes('/dashboard/anonymous-question') ? 'text-black border-b-2 border-black pb-1' : 'text-gray-700 hover:text-black'}`}
                >
                  Anonymous Q&A
                </Link>
                <Link 
                  href="/dashboard/quiz-creator"
                  className={`font-medium transition-colors ${pathname.includes('/dashboard/quiz-creator') ? 'text-black border-b-2 border-black pb-1' : 'text-gray-700 hover:text-black'}`}
                >
                  Quiz Creator
                </Link>
                <Link 
                  href="/dashboard/crossword-puzzle"
                  className={`relative font-medium transition-colors ${pathname.includes('/dashboard/crossword-puzzle') ? 'text-black border-b-2 border-black pb-1' : 'text-gray-700 hover:text-black'}`}
                >
                  Crossword Puzzle
                  <span className="absolute bottom-[-28px] left-1/2 -translate-x-1/2 text-xs text-black border-2 border-black px-2 py-1 bg-white whitespace-nowrap flex items-center justify-center shadow-sm">
                    BETA
                  </span>
                </Link>
              </nav>
              <div className="h-6 w-px bg-black"></div> {/* Solid black divider */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 group"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-black font-medium border border-black">
                    {userName?.[0].toUpperCase()}
                  </div>
                  <span className="text-black group-hover:text-gray-800">{userName}</span>
                  <ChevronDown className={`w-5 h-5 text-black transition-transform ${showUserMenu ? 'rotate-180' : ''}`} /> {/* Lucide ChevronDown */}
                </button>

                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-none shadow-lg py-1 border-2 border-black z-10"> {/* Added z-10 */}
                    <Link
                      href="/dashboard/billing"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-black hover:bg-gray-100 transition-colors"
                    >
                      <CreditCard className="w-5 h-5" /> {/* Lucide CreditCard */}
                      Billing
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-black hover:bg-gray-100 transition-colors"
                    >
                      <Settings className="w-5 h-5" /> {/* Lucide Settings */}
                      Settings
                    </Link>
                    <div className="border-t border-black my-1"></div> {/* Solid black divider */}
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-black hover:bg-gray-100 w-full text-left transition-colors"
                    >
                      <LogOut className="w-5 h-5" /> {/* Lucide LogOut */}
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile menu (Expanded) */}
          {showMobileMenu && (
            <div 
              className="md:hidden border-t-2 border-black pt-4 pb-3" // Added border-t for visual separation
              ref={mobileMenuRef} // Set ref here for click outside
            >
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                <Link 
                  href="/dashboard"
                  onClick={() => setShowMobileMenu(false)}
                  className={`block px-3 py-2 rounded-none text-base font-medium ${pathname === '/dashboard' ? 'bg-gray-100 text-black border border-black' : 'text-gray-700 hover:bg-gray-100 hover:text-black'}`}
                >
                  Home
                </Link>
                <Link 
                  href="/dashboard/anonymous-question"
                  onClick={() => setShowMobileMenu(false)}
                  className={`block px-3 py-2 rounded-none text-base font-medium ${pathname === '/dashboard/anonymous-question' ? 'bg-gray-100 text-black border border-black' : 'text-gray-700 hover:bg-gray-100 hover:text-black'}`}
                >
                  Anonymous Q&A
                </Link>
                <Link 
                  href="/dashboard/crossword-puzzle"
                  onClick={() => setShowMobileMenu(false)}
                  className={`block px-3 py-2 rounded-none text-base font-medium ${pathname === '/dashboard/crossword-puzzle' ? 'bg-gray-100 text-black border border-black' : 'text-gray-700 hover:bg-gray-100 hover:text-black'}`}
                >
                  Crossword Puzzle
                </Link>
              </div>
              <div className="pt-4 pb-3 border-t-2 border-black">
                <div className="flex items-center px-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-black font-medium border border-black">
                      {userName?.[0].toUpperCase()}
                    </div>
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-black">{userName}</div>
                  </div>
                </div>
                <div className="mt-3 px-2 space-y-1">
                  <Link
                    href="/dashboard/billing"
                    onClick={() => setShowMobileMenu(false)}
                    className="block px-3 py-2 rounded-none text-base font-medium text-black hover:bg-gray-100"
                  >
                    Billing
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setShowMobileMenu(false)}
                    className="block px-3 py-2 rounded-none text-base font-medium text-black hover:bg-gray-100"
                  >
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      setShowMobileMenu(false)
                      handleSignOut()
                    }}
                    className="block w-full text-left px-3 py-2 rounded-none text-base font-medium text-black hover:bg-gray-100"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Page Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12"> {/* Reduced padding for mobile, increased for desktop */}
        {children}
      </div>
    </main>
  )
}