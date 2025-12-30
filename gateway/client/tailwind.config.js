/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // DoAi.Me 브랜드 컬러 (CSS 변수 사용)
        doai: {
          300: 'rgb(var(--doai-300) / <alpha-value>)',
          400: 'rgb(var(--doai-400) / <alpha-value>)',
          500: 'rgb(var(--doai-500) / <alpha-value>)',
        },
        // Control Room 배경 컬러 (CSS 변수 사용)
        room: {
          500: 'rgb(var(--room-500) / <alpha-value>)',
          600: 'rgb(var(--room-600) / <alpha-value>)',
          700: 'rgb(var(--room-700) / <alpha-value>)',
          800: 'rgb(var(--room-800) / <alpha-value>)',
          900: 'rgb(var(--room-900) / <alpha-value>)',
        }
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping': 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
        'spin': 'spin 1s linear infinite',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        ping: {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
