import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundColor: {
        'white': '#ffffff',
      },
      fontFamily: {
        sans: ['Oswald', 'Arial', 'sans-serif'],
        oswald: ['Oswald', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config 