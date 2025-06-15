// components/NamePromptModal.tsx
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'; // Added Lucide X icon for consistency

interface NamePromptModalProps {
  onClose: () => void
  onSubmit: (name: string) => void
  defaultName?: string
}

export default function NamePromptModal({ onClose, onSubmit, defaultName = '' }: NamePromptModalProps) {
  const [name, setName] = useState(defaultName)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(name.trim())
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-none shadow-xl max-w-md w-full border-2 border-black"> {/* Redesigned container */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-black">Welcome to QuestionBoard</h2> {/* Changed text color */}
          <button
            onClick={onClose}
            className="text-black hover:text-gray-700 transition-colors" /* Changed icon color */
          >
            <X className="w-6 h-6" /> {/* Lucide X icon */}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-black mb-1"> {/* Changed text color */}
              Your Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-white border-2 border-black rounded-none text-black focus:outline-none focus:ring-0 focus:border-black transition-all" /* Redesigned input */
              placeholder="Enter your name (or leave blank to remain anonymous)"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-black hover:text-gray-700 transition-colors rounded-none border-2 border-transparent hover:border-black" /* Redesigned secondary button */
            >
              Skip
            </button>
            <button
              type="submit"
              className="bg-black text-white px-4 py-2 rounded-none hover:bg-gray-800 transition-all shadow-md font-medium border border-black" /* Redesigned primary button */
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}