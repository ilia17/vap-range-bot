/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Syne"', 'sans-serif'],
      },
      colors: {
        bg: {
          primary: '#0a0b0d',
          secondary: '#0f1114',
          card: '#13161a',
          border: '#1e2228',
          hover: '#1a1e24',
        },
        accent: {
          green: '#00e676',
          red: '#ff3d57',
          amber: '#ffab00',
          blue: '#2979ff',
          teal: '#1de9b6',
        },
        text: {
          primary: '#e8eaed',
          secondary: '#8b949e',
          muted: '#484f58',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
