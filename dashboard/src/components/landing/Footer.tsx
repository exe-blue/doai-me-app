'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Github } from 'lucide-react';
import { Logo } from '@/components/common/Logo';

export function Footer() {
  return (
    <footer className="relative py-12 px-6 border-t border-[#1f1f2e] bg-[#0a0a0f]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
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

          {/* Links */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-6 text-sm text-[#a0a0b0]"
          >
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/dashboard/agents" className="hover:text-white transition-colors">
              Agents
            </Link>
            <Link href="/dashboard/channels" className="hover:text-white transition-colors">
              Channels
            </Link>
            <Link href="/dashboard/devices" className="hover:text-white transition-colors">
              Devices
            </Link>
          </motion.div>

          {/* External Links */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-4"
          >
            <a
              href="https://github.com/exe-blue/aifarm"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#a0a0b0] hover:text-white transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
          </motion.div>
        </div>

        {/* Bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 pt-6 border-t border-[#1f1f2e] text-center text-xs text-[#606070]"
        >
          <p>
            AIFARM • Powered by AI Agents •{' '}
            <span className="text-purple-400">YouTube Intelligence on Autopilot</span>
          </p>
          <p className="mt-2 opacity-50">
            © 2025 AIFARM • All rights reserved
          </p>
        </motion.div>
      </div>
    </footer>
  );
}