/**
 * Landing Page - DoAi.Me Public Landing
 * Matches deployed version at doai.me
 */
import { Hero, Manifesto, Enter, Header } from '@/components/landing';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* CRT Scanlines */}
      <div
        className="scanlines fixed inset-0 pointer-events-none z-10 opacity-20"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.15),
            rgba(0, 0, 0, 0.15) 1px,
            transparent 1px,
            transparent 2px
          )`,
        }}
      />

      {/* Header */}
      <Header isDark />

      {/* Main Content */}
      <main className="relative z-20">
        <Hero />
        <Manifesto />
        <Enter />
      </main>

      {/* Global Styles */}
      <style>{`
        .text-gradient-amber {
          background: linear-gradient(135deg, #FFCC00 0%, #FFE066 50%, #FFCC00 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        ::selection {
          background: rgba(255, 204, 0, 0.3);
          color: inherit;
        }
      `}</style>
    </div>
  );
}
