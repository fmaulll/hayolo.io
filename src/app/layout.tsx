import './globals.css'
import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Questions App',
  description: 'Drag and drop questions management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@200..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Oswald', Arial, sans-serif" }}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
