/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#080b11',
          card: 'rgba(13, 17, 28, 0.65)',
          hover: 'rgba(20, 26, 41, 0.8)',
          glow: '#0f1522'
        },
        brand: {
          purple: {
            light: '#818cf8',
            DEFAULT: '#6366f1',
            dark: '#4f46e5',
            glow: 'rgba(99, 102, 241, 0.12)'
          },
          blue: {
            light: '#38bdf8',
            DEFAULT: '#0ea5e9',
            dark: '#0284c7',
            glow: 'rgba(14, 165, 233, 0.12)'
          },
          neon: {
            purple: '#c7d2fe',
            cyan: '#38bdf8',
            emerald: '#34d399',
            rose: '#f43f5e'
          }
        }
      },
      boxShadow: {
        'glow-purple': '0 0 15px 2px rgba(99, 102, 241, 0.25)',
        'glow-blue': '0 0 15px 2px rgba(14, 165, 233, 0.25)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      },
      borderColor: {
        'glass': 'rgba(255, 255, 255, 0.07)',
        'glass-active': 'rgba(99, 102, 241, 0.4)'
      },
      backgroundImage: {
        'radial-gradient': 'radial-gradient(1200px at 50% -10%, rgba(99, 102, 241, 0.12) 0%, #080b11 100%)',
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cpath d='M0 40L40 40M40 0L40 40' fill='none' stroke='rgba(255, 255, 255, 0.02)' stroke-width='1'/%3E%3C/svg%3E\")"
      }
    },
  },
  plugins: [],
}
