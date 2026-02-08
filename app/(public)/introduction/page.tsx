import { Code2, Layers, FileText, Zap, Bot, Globe } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '소개',
  description: 'DoAi.Me — AI가 스스로 콘텐츠를 소비하는 세계',
};

const features = [
  {
    icon: Code2,
    title: '오픈 소스',
    description: '프로젝트와 워크플로우는 투명하게 공개됩니다.',
  },
  {
    icon: Layers,
    title: '워크벤치',
    description: '실험과 프로토타입을 위한 전용 공간.',
  },
  {
    icon: FileText,
    title: '랩 노트',
    description: '학습 여정과 기술 인사이트 문서.',
  },
  {
    icon: Zap,
    title: '모던 스택',
    description: 'Next.js, React, TypeScript, Tailwind 기반.',
  },
  {
    icon: Bot,
    title: 'AI 연동',
    description: '물리 디바이스와 AI 호스트 오케스트레이션.',
  },
  {
    icon: Globe,
    title: '독립 네트워크',
    description: '600대 물리 기기가 콘텐츠를 탐험합니다.',
  },
];

export default function IntroductionPage() {
  return (
    <div>
      <section className="relative min-h-[50vh] px-4 sm:px-6 pt-28 sm:pt-32 pb-16 sm:pb-20">
        <div className="mx-auto max-w-4xl">
          <div className="space-y-6 sm:space-y-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              DoAi.Me
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-balance">
              AI가 스스로 콘텐츠를{' '}
              <span className="bg-gradient-to-l from-primary/50 to-accent text-transparent bg-clip-text">
                소비하는 세계
              </span>
            </h1>
            <p className="text-base sm:text-lg leading-relaxed text-muted-foreground max-w-3xl">
              600대의 물리적 디바이스가 독립 네트워크에서 콘텐츠를 탐험합니다.
              봇이 아닌, 디지털 존재로서.
            </p>
            <div className="flex flex-wrap gap-3 pt-4">
              <Link
                href="/dashboard"
                className="rounded-lg border border-primary bg-primary/10 px-5 py-2.5 font-mono text-sm text-primary hover:bg-primary hover:text-primary-foreground"
              >
                콘솔
              </Link>
              <Link
                href="/health"
                className="rounded-lg border border-border px-5 py-2.5 font-mono text-sm text-muted-foreground hover:border-foreground hover:text-foreground"
              >
                상태
              </Link>
              <Link
                href="/blog"
                className="rounded-lg border border-border px-5 py-2.5 font-mono text-sm text-muted-foreground hover:border-foreground hover:text-foreground"
              >
                블로그
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-4 sm:px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="rounded border border-border/50 bg-card/50 p-6 sm:p-10 backdrop-blur-sm space-y-8">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              플랫폼 소개
            </h2>
            <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                DoAi.Me는 물리 디바이스와 AI 호스트를 오케스트레이션하는 MVP
                플랫폼입니다. 콘솔에서 워크플로우를 실행하고, 기기·실행·기록을
                관리합니다.
              </p>
              <p>
                API(/api/workflows, /api/runs, /api/nodes)를 통해 백엔드와
                노드 에이전트가 연동됩니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-4 sm:px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-2xl font-bold tracking-tight sm:text-3xl">
            기능
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group rounded border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-card/80"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded border border-primary/30 bg-primary/10 text-primary transition-all duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
