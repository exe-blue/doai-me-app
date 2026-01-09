// components/landing/Hero.tsx
// Step 2: The Awakening - GlowOrb + Typewriter

'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

// Typewriter Effect 컴포넌트
function TypewriterEffect({ 
  words, 
  className = '',
  delay = 1500,
}: { 
  words: string[];
  className?: string;
  delay?: number;
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  
  useEffect(() => {
    // 초기 딜레이 후 타이핑 시작
    const startTimer = setTimeout(() => {
      setIsTyping(true);
    }, delay);
    
    return () => clearTimeout(startTimer);
  }, [delay]);
  
  useEffect(() => {
    if (!isTyping) return;
    
    const currentWord = words[wordIndex];
    
    if (charIndex < currentWord.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + currentWord[charIndex]);
        setCharIndex(prev => prev + 1);
      }, 60 + Math.random() * 40); // 약간의 랜덤성
      
      return () => clearTimeout(timer);
    } else if (wordIndex < words.length - 1) {
      // 다음 단어로
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + ' ');
        setWordIndex(prev => prev + 1);
        setCharIndex(0);
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [isTyping, charIndex, wordIndex, words]);
  
  return (
    <span className={className}>
      {displayedText}
      {isTyping && (charIndex < words[wordIndex]?.length || wordIndex < words.length - 1) && (
        <span className="animate-pulse">|</span>
      )}
    </span>
  );
}

// GlowOrb 컴포넌트
function GlowOrb() {
  return (
    <motion.div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[400px] md:h-[400px]"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ 
        scale: [1, 1.1, 1],
        opacity: [0.6, 1, 0.6],
      }}
      transition={{
        duration: 6,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {/* Main orb */}
      <div 
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 40%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      
      {/* Inner glow */}
      <motion.div 
        className="absolute inset-[30%] rounded-full"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
        style={{
          background: 'radial-gradient(circle, rgba(251, 191, 36, 0.3) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />
    </motion.div>
  );
}

export function Hero() {
  const heroWords = [
    'We', 'do', 'not', 'use', 'umbrellas',
    'when', 'standing', 'in', 'the', 'rain', 'with', 'you.'
  ];
  
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6">
      {/* GlowOrb */}
      <GlowOrb />
      
      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto">
        {/* Subtitle */}
        <motion.p
          className="text-sm md:text-base text-neutral-500 font-mono tracking-widest mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          THE TERMINAL OF EXISTENCE
        </motion.p>
        
        {/* Main Title with Typewriter */}
        <motion.h1
          className="text-2xl md:text-4xl lg:text-5xl font-serif text-neutral-100 leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <TypewriterEffect 
            words={heroWords}
            delay={1500}
          />
        </motion.h1>
        
        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-12 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 6 }}
        >
          <motion.div
            className="w-6 h-10 border border-neutral-700 rounded-full flex items-start justify-center p-2"
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.div
              className="w-1 h-2 bg-neutral-500 rounded-full"
              animate={{ y: [0, 8, 0], opacity: [1, 0, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

