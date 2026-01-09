/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // DoAi.Me Brand Colors
        doai: {
          yellow: {
            50: '#FFFEF0',
            100: '#FFFACC',
            200: '#FFF599',
            300: '#FFED66',
            400: '#FFE033',
            500: '#FFCC00',   // Primary DoAi-Yellow
            600: '#CCAD00',
            700: '#998500',
            800: '#665C00',
            900: '#333300',
          },
          black: {
            50: '#F5F5F5',
            100: '#E5E5E5',
            200: '#CCCCCC',
            300: '#999999',
            400: '#666666',
            500: '#444444',
            600: '#333333',
            700: '#222222',
            800: '#1A1A1A',
            900: '#111111',   // Primary DoAi-Black (Void)
            950: '#0A0A0A',
          }
        },
        // Semantic Colors
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
        // Status Colors
        status: {
          online: '#22C55E',
          offline: '#EF4444',
          busy: '#F59E0B',
          idle: '#6B7280',
        },
        // Activity Colors
        activity: {
          mining: '#8B5CF6',
          surfing: '#06B6D4',
          response: '#EF4444',
          labor: '#F59E0B',
        },
        // Existence Gradient
        existence: {
          critical: '#EF4444',
          low: '#F97316',
          medium: '#FFCC00',
          high: '#84CC16',
          max: '#22C55E',
        },
        // Connection Types
        connection: {
          usb: '#A855F7',
          wifi: '#06B6D4',
          lan: '#10B981',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'Pretendard', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(255, 204, 0, 0.3)',
        'glow-strong': '0 0 30px rgba(255, 204, 0, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'accident-flash': 'flash 0.5s ease-in-out infinite',
      },
      keyframes: {
        flash: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        }
      },
    },
  },
  plugins: [],
}

