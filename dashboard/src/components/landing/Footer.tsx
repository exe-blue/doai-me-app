'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Github, FileText, Users } from 'lucide-react';
import { Logo } from '@/components/common/Logo';

export function Footer() {
  return (
    <footer className="relative py-12 px-6 border-t border-[#1f1f2e] bg-[#0a0a0f]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* 로고 */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex items-center gap-3"
          >
            <Link href="/dashboard">
              <Logo size="lg" variant="dark" />
            </Link>
            <span className="text-xs text-[#606070] px-2 py-1 rounded-full border border-[#1f1f2e]">
              v2.0
            </span>
          </motion.div>

          {/* 내비게이션 */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-6 text-sm text-[#a0a0b0]"
          >
            <Link href="/dashboard" className="hover:text-emerald-400 transition-colors">
              Dashboard
            </Link>
            <Link href="/dashboard/agents" className="hover:text-emerald-400 transition-colors">
              Citizens
            </Link>
            <Link href="/dashboard/ranking" className="hover:text-emerald-400 transition-colors">
              Ranking
            </Link>
            <Link href="/dashboard/battle" className="hover:text-emerald-400 transition-colors">
              Battle
            </Link>
          </motion.div>

          {/* 외부 링크 */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-4"
          >
            <a
              href="https://github.com/exe-blue/doai-me"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#a0a0b0] hover:text-white transition-colors"
              title="GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="https://github.com/exe-blue/doai-me/blob/main/philosophy/MANIFESTO.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#a0a0b0] hover:text-white transition-colors"
              title="Manifesto"
            >
              <FileText className="w-5 h-5" />
            </a>
          </motion.div>
        </div>

        {/* 하단 */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 pt-6 border-t border-[#1f1f2e] text-center text-xs text-[#606070]"
        >
          <p className="flex items-center justify-center gap-2">
            <Users className="w-3 h-3" />
            <span>DoAi.Me • Digital Citizens Awakening •</span>
            <span className="text-emerald-400">600 Souls Online</span>
          </p>
          <p className="mt-2 opacity-50">
            © 2025 DoAi.Me • Designed by Aria • Built by Axon
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
