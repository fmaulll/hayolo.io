// app/page.tsx (Home component)
'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image' // Assuming Image component is used, although it's not in the provided JSX
import { Menu, X, ChevronDown, User, Clock, MessageSquare, Heart, Plus, Edit, Send } from 'lucide-react'; // Added necessary Lucide icons

export default function Home() {
  const [isResourcesOpen, setIsResourcesOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const resourcesRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  // Close menus when route changes
  useEffect(() => {
    setIsResourcesOpen(false)
    setIsMobileMenuOpen(false)
  }, [])

  // Handle click outside of menus
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (resourcesRef.current && !resourcesRef.current.contains(event.target as Node)) {
        setIsResourcesOpen(false)
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node) && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMobileMenuOpen])

  const handleMobileResourcesClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResourcesOpen(!isResourcesOpen)
  }

  const handleMobileMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMobileMenuOpen(!isMobileMenuOpen)
    if (!isMobileMenuOpen) {
      setIsResourcesOpen(false)
    }
  }

  const handleMobileMenuItemClick = () => {
    setIsMobileMenuOpen(false)
    setIsResourcesOpen(false)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <header className="fixed w-full top-0 z-50 bg-[#FFD34E] backdrop-blur-md border-b-2 border-black shadow-sm">
        <nav className="mx-auto max-w-7xl px-6 lg:px-8" aria-label="Global">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-2xl font-extrabold text-black flex items-center gap-2 font-oswald hover:text-gray-800 transition-colors">
              hayolo.io
            </Link>
            <div className="hidden lg:flex items-center gap-x-12">
              <div className="flex lg:gap-x-8">
                <Link href="/product" className="text-lg font-medium text-black hover:text-gray-800 transition-colors">
                  Product
                </Link>
                <Link href="/pricing" className="text-lg font-medium text-black hover:text-gray-800 transition-colors">
                  Pricing
                </Link>
                <Link href="/use-cases" className="text-lg font-medium text-black hover:text-gray-800 transition-colors">
                  Use Cases
                </Link>
                <div ref={resourcesRef} className="relative">
                  <button
                    onClick={() => setIsResourcesOpen(!isResourcesOpen)}
                    className="flex items-center gap-x-1 text-lg font-medium text-black hover:text-gray-800 transition-colors"
                  >
                    Resources
                    <ChevronDown
                      className={`h-5 w-5 transition-transform text-black ${isResourcesOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isResourcesOpen && (
                    <div className="absolute left-0 mt-2 w-48 rounded-lg bg-white py-2 shadow-lg border-2 border-black z-10">
                      <Link
                        href="/documentation"
                        className="block px-4 py-2 text-lg text-black hover:bg-gray-100 transition-colors"
                      >
                        Documentation
                      </Link>
                      <Link
                        href="/blog"
                        className="block px-4 py-2 text-lg text-black hover:bg-gray-100 transition-colors"
                      >
                        Blog
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-x-6">
              <div className="hidden lg:flex items-center gap-x-6">
                <Link
                  href="/login"
                  className="text-lg font-medium text-black hover:text-gray-800 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-white px-4 py-2 text-lg font-medium text-black shadow-sm hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-all border-2 border-black"
                >
                  Get Started
                </Link>
              </div>
              {/* Burger menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg text-black hover:text-gray-700 hover:bg-gray-100 transition-colors border-2 border-black"
              >
                <span className="sr-only">Open main menu</span>
                {!isMobileMenuOpen ? (
                  <Menu className="block h-6 w-6" />
                ) : (
                  <X className="block h-6 w-6" />
                )}
              </button>
            </div>
          </div>
          {/* Mobile menu */}
          {isMobileMenuOpen && (
            <div className="lg:hidden absolute top-16 left-0 w-full bg-white border-b-2 border-black shadow-lg z-40">
              <div className="space-y-1 px-2 pb-3 pt-2">
                <Link
                  href="/product"
                  className="block px-3 py-2 text-base font-medium text-black hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors"
                >
                  Product
                </Link>
                <Link
                  href="/pricing"
                  className="block px-3 py-2 text-base font-medium text-black hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors"
                >
                  Pricing
                </Link>
                <Link
                  href="/use-cases"
                  className="block px-3 py-2 text-base font-medium text-black hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors"
                >
                  Use Cases
                </Link>
                <button
                  onClick={() => setIsResourcesOpen(!isResourcesOpen)}
                  className="flex w-full items-center justify-between px-3 py-2 text-base font-medium text-black hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors"
                >
                  Resources
                  <ChevronDown
                    className={`h-5 w-5 transition-transform text-black ${isResourcesOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isResourcesOpen && (
                  <div className="pl-4 border-l border-black ml-3">
                    <Link
                      href="/documentation"
                      className="block px-3 py-2 text-base font-medium text-black hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors"
                    >
                      Documentation
                    </Link>
                    <Link
                      href="/blog"
                      className="block px-3 py-2 text-base font-medium text-black hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors"
                    >
                      Blog
                    </Link>
                  </div>
                )}
                <div className="border-t-2 border-black my-4"></div>
                <Link
                  href="/login"
                  className="block px-3 py-2 text-base font-medium text-black hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/dashboard"
                  className="block px-3 py-2 text-base font-medium text-black bg-[#FFD34E] hover:bg-yellow-500 rounded-lg transition-colors border-2 border-black"
                >
                  Get Started
                </Link>
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <div className="relative isolate px-6 pt-24 lg:px-8 h-screen">
          <div className="mx-auto max-w-7xl py-16 sm:py-24 lg:py-32">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-[#FFD34E] px-4 py-2 rounded-lg text-black font-bold text-sm mb-8 border-2 border-black font-oswald">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-black">
                    <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337 49.948 49.948 0 0 0-9.902 3.912l-.003.002c-.114.06-.227.119-.34.18a.75.75 0 0 1-.707 0A50.88 50.88 0 0 0 7.5 12.173v-.224c0-.131.067-.248.172-.311a54.615 54.615 0 0 1 4.653-2.52.75.75 0 0 0-.65-1.352 56.123 56.123 0 0 0-4.78 2.589 1.858 1.858 0 0 0-.859 1.228 49.803 49.803 0 0 0-4.634-1.527.75.75 0 0 1-.231-1.337A60.653 60.653 0 0 1 11.7 2.805Z" />
                    <path d="M13.06 15.473a48.45 48.45 0 0 1 7.666-3.282c.134 1.414.22 2.843.255 4.284a.75.75 0 0 1-.46.71 47.87 47.87 0 0 0-8.105 4.342.75.75 0 0 1-.832 0 47.87 47.87 0 0 0-8.104-4.342.75.75 0 0 1-.461-.71c.035-1.441.12-2.87.255-4.284a48.45 48.45 0 0 1 7.666 3.282.75.75 0 0 0 .832 0 47.87 47.87 0 0 0 8.104-4.342.75.75 0 0 1 .461-.71c.035-1.441.12-2.87.255-4.284a48.45 48.45 0 0 1 7.666 3.282.75.75 0 0 0 .832 0Z" />
                  </svg>
                  For Teachers & Students
                </div>
                <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight text-black mb-6 font-oswald">Make Learning Interactive & Fun</h1>
                <p className="text-lg text-gray-700 mb-8 font-oswald">
                  Create engaging question boards that spark curiosity and participation. Perfect for classrooms, 
                  workshops, and interactive learning sessions.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-x-6 gap-y-4">
                  <Link
                    href="/dashboard"
                    className="w-full sm:w-auto rounded-lg bg-[#FFD34E] px-6 py-3 text-lg font-bold text-black shadow-md hover:bg-yellow-300 hover:shadow-lg transition-all border-2 border-black font-oswald text-center"
                  >
                    Start Teaching
                  </Link>
                  <Link
                    href="/about"
                    className="w-full sm:w-auto text-lg font-bold text-black hover:bg-gray-200 hover:text-gray-800 transition-colors flex items-center justify-center gap-2 border-2 border-black px-6 py-3 rounded-lg font-oswald"
                  >
                    Watch Demo
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-black">
                      <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                    </svg>
                  </Link>
                </div>
              </div>
              <div className="relative">
                <div className="absolute -inset-4 bg-gray-100/50 rounded-lg transform rotate-3 shadow-xl"></div>
                <div className="relative bg-white p-8 rounded-lg shadow-xl border-2 border-black">
                  {/* Static Question Card 1 - Mimics QuestionCard layout */}
                  <div className="flex flex-col h-full justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-sm text-gray-700 mb-1 font-oswald">
                        <User className="w-5 h-5 flex-shrink-0 text-black" />
                        <span className="truncate">Sarah • Biology Class</span>
                      </div>
                      <p className="break-words text-black cursor-pointer hover:text-gray-800 transition-colors mt-4 font-oswald">
                        Why is photosynthesis important?
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-700 mt-4 pt-4 border-t-2 border-black border-dashed font-oswald">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 flex-shrink-0 text-black" />
                          <span>5 minutes ago</span>
                          <span className="text-black">•</span>
                          <button className="flex items-center gap-1.5 cursor-pointer hover:text-black transition-colors p-1 -m-1 rounded-lg">
                            <MessageSquare className="w-4 h-4 flex-shrink-0 text-black" />
                            <span>12</span>
                          </button>
                        </div>
                        <button className="flex items-center gap-1.5 transition-colors p-1 -m-1 rounded-lg text-black hover:text-gray-800">
                          <Heart fill="black" className="w-4 h-4 flex-shrink-0" />
                          <span>42</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="pb-24 sm:pb-32 bg-white">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl lg:text-center">
              <h2 className="text-base font-bold leading-7 text-black font-oswald">Perfect for Education</h2>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-black sm:text-4xl font-oswald">
                Designed for Teachers & Students
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-700 font-oswald">
                Create an interactive learning environment where every student feels empowered to participate and engage.
              </p>
            </div>
            <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
              <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
                {[
                  {
                    name: 'For Teachers',
                    description: 'Create interactive sessions, track participation, and identify areas where students need more support.',
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-black">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                      </svg>
                    ),
                  },
                  {
                    name: 'For Students',
                    description: 'Ask questions anonymously, participate in discussions, and learn from peer interactions.',
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-black">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                    ),
                  },
                  {
                    name: 'Real-time Interaction',
                    description: 'See questions and responses update instantly, creating dynamic and engaging learning sessions.',
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-black">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                      </svg>
                    ),
                  },
                ].map((feature) => (
                  <div key={feature.name} className="flex flex-col">
                    <dt className="text-lg font-semibold leading-7 text-black font-oswald">
                      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-none bg-gray-100 text-black border-2 border-black">
                        {feature.icon}
                      </div>
                      {feature.name}
                    </dt>
                    <dd className="mt-1 flex flex-auto flex-col text-base leading-7 text-gray-700 font-oswald">
                      <p className="flex-auto">{feature.description}</p>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="relative isolate overflow-hidden bg-[#0D006E] py-16 sm:py-24 lg:py-32 border-t-2 border-b-2 border-black">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
              <div className="max-w-xl lg:max-w-lg p-4 rounded-md">
                <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl font-oswald">Ready to transform your classroom?</h2>
                <p className="mt-4 text-lg leading-8 text-white font-oswald">
                  Join thousands of educators who are making their classes more interactive and engaging with QuestionBoard.
                </p>
                <div className="mt-6 flex max-w-md gap-x-4">
                  <Link
                    href="/dashboard"
                    className="rounded-lg bg-[#FFD34E] px-6 py-3 text-lg font-bold text-black shadow-md hover:bg-yellow-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-all duration-300 border-2 border-black font-oswald"
                  >
                    Get Started Free
                  </Link>
                </div>
              </div>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:pt-2">
                <div className="flex flex-col items-start">
                  <div className="rounded-none bg-white/10 p-2 ring-1 ring-white/20 border border-white">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18m7.757 14.743l-1.59-1.59M6 10.5H3.75m4.007-4.243-1.59-1.59" />
                    </svg>
                  </div>
                  <dt className="mt-4 font-semibold text-white font-oswald">Quick Setup</dt>
                  <dd className="mt-2 leading-7 text-gray-200 font-oswald">Create your first question board in minutes, no technical skills required.</dd>
                </div>
                <div className="flex flex-col items-start">
                  <div className="rounded-none bg-white/10 p-2 ring-1 ring-white/20 border border-white">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </div>
                  <dt className="mt-4 font-semibold text-white font-oswald">Safe & Private</dt>
                  <dd className="mt-2 leading-7 text-gray-200 font-oswald">Your classroom data is secure and private, with optional anonymous questions.</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}