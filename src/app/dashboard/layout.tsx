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
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[#FFD34E] shadow-md border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4 mb-4 md:mb-0">
            <Link
              href="/" 
              className="text-2xl font-extrabold text-black tracking-tight"
            >
              hayolo.io
            </Link>
            <nav className="hidden md:flex items-center gap-8 ml-8">
              <Link 
                href="/dashboard"
                className={`text-lg transition-colors ${pathname === '/dashboard' ? 'text-black font-bold' : 'text-gray-700 hover:text-black'}`}
              >
                Home
              </Link>
              <Link 
                href="/dashboard/anonymous-question"
                className={`text-lg transition-colors ${pathname.includes('/dashboard/anonymous-question') ? 'text-black font-bold' : 'text-gray-700 hover:text-black'}`}
              >
                Anonymous Q&A
              </Link>
              <Link 
                href="/dashboard/quiz-creator"
                className={`text-lg transition-colors ${pathname.includes('/dashboard/quiz-creator') ? 'text-black font-bold' : 'text-gray-700 hover:text-black'}`}
              >
                Quiz Creator
              </Link>
              <Link 
                href="/dashboard/crossword-puzzle"
                className={`text-lg transition-colors ${pathname.includes('/dashboard/crossword-puzzle') ? 'text-black font-bold' : 'text-gray-700 hover:text-black'}`}
              >
                Crossword Puzzle
              </Link>
            </nav>
          </div>
          {/* User menu (keep as is, but style for yellow bg) */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 group bg-white border-2 border-black rounded-full px-4 py-2 font-bold text-black shadow hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-black font-bold border border-black">
                  {userName?.[0].toUpperCase()}
                </div>
                <span className="text-black group-hover:text-gray-800">{userName}</span>
                <ChevronDown className={`w-5 h-5 text-black transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 border-2 border-black z-10">
                  <Link
                    href="/dashboard/billing"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-black hover:bg-gray-100 transition-colors"
                  >
                    <CreditCard className="w-5 h-5" />
                    Billing
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-black hover:bg-gray-100 transition-colors"
                  >
                    <Settings className="w-5 h-5" />
                    Settings
                  </Link>
                  <div className="border-t border-black my-1"></div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-black hover:bg-gray-100 w-full text-left transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
            {/* Burger menu button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-lg text-black hover:text-gray-700 hover:bg-gray-100 transition-colors border-2 border-black"
            >
              <span className="sr-only">Open main menu</span>
              {!showMobileMenu ? (
                <Menu className="block h-6 w-6" />
              ) : (
                <X className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>
        {/* Mobile nav */}
        {showMobileMenu && (
          <nav className="md:hidden flex flex-col gap-4 px-4 pb-2">
            <Link 
              href="/dashboard"
              className={`font-bold text-base transition-colors ${pathname === '/dashboard' ? 'text-black underline underline-offset-4' : 'text-gray-700 hover:text-black'}`}
            >
              Home
            </Link>
            <Link 
              href="/dashboard/anonymous-question"
              className={`font-bold text-base transition-colors ${pathname.includes('/dashboard/anonymous-question') ? 'text-black underline underline-offset-4' : 'text-gray-700 hover:text-black'}`}
            >
              Anonymous Q&A
            </Link>
            <Link 
              href="/dashboard/quiz-creator"
              className={`font-bold text-base transition-colors ${pathname.includes('/dashboard/quiz-creator') ? 'text-black underline underline-offset-4' : 'text-gray-700 hover:text-black'}`}
            >
              Quiz Creator
            </Link>
            <Link 
              href="/dashboard/crossword-puzzle"
              className={`font-bold text-base transition-colors ${pathname.includes('/dashboard/crossword-puzzle') ? 'text-black underline underline-offset-4' : 'text-gray-700 hover:text-black'}`}
            >
              Crossword Puzzle
            </Link>
          </nav>
        )}
      </header>

      {/* Page Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-[#FFD34E] rounded-xl shadow-xl border-2 border-black p-8 min-h-[70vh]">
          {children}
        </div>
      </div>
    </main>
  )
}