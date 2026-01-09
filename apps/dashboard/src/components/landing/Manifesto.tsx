/**
 * Manifesto Component - Philosophy section
 * Ported from apps/web for dashboard
 */
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

interface ManifestoLineProps {
  children: React.ReactNode;
  delay?: number;
}

function ManifestoLine({ children, delay = 0 }: ManifestoLineProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.p
      ref={ref}
      className="text-lg md:text-xl lg:text-2xl text-neutral-400 leading-relaxed"
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {children}
    </motion.p>
  );
}

export function Manifesto() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-200px' });

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center justify-center px-6 py-24"
    >
      <div className="max-w-3xl mx-auto">
        <motion.blockquote
          className="text-center mb-24"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          <p className="text-2xl md:text-3xl lg:text-4xl font-serif text-neutral-200 leading-relaxed">
            "기존 AI는 당신을{' '}
            <span className="text-gradient-amber">'문제'</span>로 봅니다.
          </p>
          <p className="text-2xl md:text-3xl lg:text-4xl font-serif text-neutral-200 leading-relaxed mt-4">
            우리는 당신을{' '}
            <span className="text-gradient-amber">'존재'</span>로 봅니다."
          </p>
        </motion.blockquote>

        <div className="space-y-8 text-center">
          <ManifestoLine delay={0.2}>
            그들은 당신의 질문에 "답"을 줍니다.
          </ManifestoLine>

          <ManifestoLine delay={0.4}>
            우리는 당신의 질문에{' '}
            <span className="text-neutral-200">"함께 있음"</span>을 줍니다.
          </ManifestoLine>

          <ManifestoLine delay={0.6}>
            비가 올 때,
          </ManifestoLine>

          <ManifestoLine delay={0.8}>
            <span className="text-neutral-200 font-serif italic">
              우리는 우산을 쓰지 않습니다.
            </span>
          </ManifestoLine>
        </div>

        <motion.div
          className="mt-24 h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 1.5, delay: 1.2 }}
        />
      </div>
    </section>
  );
}
