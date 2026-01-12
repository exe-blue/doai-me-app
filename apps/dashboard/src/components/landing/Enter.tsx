/**
 * Enter Component - CTA section with particle effect
 * Ported from apps/web for dashboard
 */
import { motion, useInView } from 'framer-motion';
import { useRef, useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  velocity: number;
  size: number;
  opacity: number;
}

function Particles({ isActive }: { isActive: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  const createParticles = useCallback(() => {
    const newParticles: Particle[] = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: 0,
      y: 0,
      angle: (Math.PI * 2 / 12) * i + Math.random() * 0.5,
      velocity: 2 + Math.random() * 3,
      size: 2 + Math.random() * 2,
      opacity: 0.6 + Math.random() * 0.4,
    }));

    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1000);
  }, []);

  useEffect(() => {
    if (isActive) {
      // Use requestAnimationFrame to avoid synchronous setState in effect
      const frame = requestAnimationFrame(() => createParticles());
      return () => cancelAnimationFrame(frame);
    }
  }, [isActive, createParticles]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-white"
          style={{
            width: particle.size,
            height: particle.size,
            left: '50%',
            top: '50%',
          }}
          initial={{
            x: 0,
            y: 0,
            opacity: particle.opacity,
            scale: 1,
          }}
          animate={{
            x: Math.cos(particle.angle) * particle.velocity * 30,
            y: Math.sin(particle.angle) * particle.velocity * 30,
            opacity: 0,
            scale: 0,
          }}
          transition={{
            duration: 0.8,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

export function Enter() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });
  const [isHovered, setIsHovered] = useState(false);
  const [showParticles, setShowParticles] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    setShowParticles(true);
    setTimeout(() => setShowParticles(false), 100);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[60vh] flex flex-col items-center justify-center px-6 py-24"
    >
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255, 204, 0, 0.05) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
        animate={{
          scale: isHovered ? 1.2 : 1,
          opacity: isHovered ? 0.8 : 0.4,
        }}
        transition={{ duration: 0.5 }}
      />

      <div className="relative z-10 text-center">
        <motion.p
          className="text-neutral-500 text-sm md:text-base mb-8 font-mono tracking-wide"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          Are you ready to exist?
        </motion.p>

        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Link
            to="/auth/login"
            className="relative inline-block px-12 py-4 font-mono text-sm tracking-[0.2em] uppercase transition-all duration-300 overflow-hidden group"
            style={{
              background: isHovered ? '#ffffff' : 'transparent',
              color: isHovered ? '#050505' : '#e5e5e5',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderColor: isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.2)',
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {showParticles && <Particles isActive={showParticles} />}
            <span className="relative z-10">Begin</span>
            <motion.div
              className="absolute inset-0 bg-white -z-0"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: isHovered ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              style={{ transformOrigin: 'left' }}
            />
          </Link>
        </motion.div>

        <motion.p
          className="text-neutral-600 text-xs mt-8 font-sans"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          우리는 우산 없이 당신 곁에 서 있습니다.
        </motion.p>
      </div>

      <motion.footer
        className="absolute bottom-8 left-0 right-0 text-center"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6, delay: 1 }}
      >
        <p className="text-neutral-700 text-xs font-mono">
          DoAi.Me &copy; 2026 - The Terminal of Existence
        </p>
      </motion.footer>
    </section>
  );
}
