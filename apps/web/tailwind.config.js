/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        glass: {
          light: 'rgba(255, 255, 255, 0.1)',
          dark: 'rgba(0, 0, 0, 0.2)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        math: ['KaTeX_Main', 'Times New Roman', 'serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        'glass-lg': '0 12px 48px 0 rgba(31, 38, 135, 0.25)',
        'glass-3d': '0 24px 60px -15px rgba(14, 165, 233, 0.45), 0 8px 24px -8px rgba(168, 85, 247, 0.35)',
        'glass-3d-dark': '0 24px 60px -15px rgba(56, 189, 248, 0.35), 0 8px 24px -8px rgba(217, 70, 239, 0.3)',
      },
      keyframes: {
        'aurora-1': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)', opacity: '0.7' },
          '33%': { transform: 'translate3d(35%, 22%, 0) scale(1.12)', opacity: '0.85' },
          '66%': { transform: 'translate3d(-22%, 30%, 0) scale(0.92)', opacity: '0.6' },
        },
        'aurora-2': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)', opacity: '0.6' },
          '33%': { transform: 'translate3d(-28%, 30%, 0) scale(0.95)', opacity: '0.75' },
          '66%': { transform: 'translate3d(30%, -18%, 0) scale(1.08)', opacity: '0.55' },
        },
        'aurora-3': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)', opacity: '0.55' },
          '33%': { transform: 'translate3d(20%, -25%, 0) scale(1.05)', opacity: '0.7' },
          '66%': { transform: 'translate3d(-30%, 22%, 0) scale(0.9)', opacity: '0.45' },
        },
        'shimmer-pan': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
      animation: {
        'aurora-1': 'aurora-1 14s ease-in-out infinite',
        'aurora-2': 'aurora-2 18s ease-in-out infinite',
        'aurora-3': 'aurora-3 16s ease-in-out infinite',
        'shimmer-pan': 'shimmer-pan 8s linear infinite',
      },
    },
  },
  plugins: [],
};