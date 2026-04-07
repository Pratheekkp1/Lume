/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        stone: {
          50: '#f8f9fa',   // White
          100: '#edf0f3',  // Frost
          200: '#dce1e8',  // Light Mist
          300: '#cdd3da',  // Mist
          400: '#9ca5b2',  // Light Slate
          500: '#6b7a8d',  // Slate
          600: '#4a5568',  // Dark Slate
          700: '#2d3748',  // Charcoal
          800: '#1a202c',  // Ink
          900: '#111827',  // Deep Ink
          950: '#0b0f17',  // Darkest
        },
        teal: {
          50: '#eafaf7',
          100: '#c5f0e8',
          200: '#9fe6d9',
          300: '#6bd9c8',
          400: '#3fc9b4',
          500: '#2a9d8f',  // Main Teal
          600: '#238377',
          700: '#1b6960',
          800: '#144f48',
          900: '#0d3531',
        },
        coral: {
          50: '#fef2ef',
          100: '#fce0d8',
          200: '#f9c0ae',
          300: '#f39a7e',
          400: '#e76f51',  // Main Coral
          500: '#d4573a',
          600: '#b2452e',
          700: '#8f3724',
          800: '#6d2a1b',
          900: '#4b1d13',
        },
      },
      animation: {
        'slide-up': 'slide-up 0.2s ease-out',
      },
      keyframes: {
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
