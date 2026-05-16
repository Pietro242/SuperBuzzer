/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        'buzz-in': 'buzz-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
        'shake': 'shake 0.5s ease-in-out',
        'slide-up': 'slide-up 0.4s ease-out both',
        'fade-in': 'fade-in 0.3s ease-out both',
        'rank-flash': 'rank-flash 0.6s ease both',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(239,68,68,0.7)' },
          '70%': { transform: 'scale(1)', boxShadow: '0 0 0 30px rgba(239,68,68,0)' },
          '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(239,68,68,0)' },
        },
        'buzz-in': {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'shake': {
          '0%,100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-10px)' },
          '40%': { transform: 'translateX(10px)' },
          '60%': { transform: 'translateX(-10px)' },
          '80%': { transform: 'translateX(10px)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(40px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'rank-flash': {
          '0%,100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(234,179,8,0.3)' },
        },
        'float': {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
