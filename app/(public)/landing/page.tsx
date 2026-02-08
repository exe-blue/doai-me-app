import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { HeroSection } from '@/components/hero-section';
import { ProjectsGrid } from '@/components/projects-grid';
import { LabNotes } from '@/components/lab-notes';
import { Workbench } from '@/components/workbench';
import { VideosSection } from '@/components/videos-section';
import { ArtifactsSection } from '@/components/artifacts-section';
import { TechSection } from '@/components/tech-section';
import { PhilosophySection } from '@/components/philosophy-section';
import {
  generateWebsiteStructuredData,
  generatePersonStructuredData,
} from '@/lib/structured-data';
import Link from 'next/link';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://doai.me';

const AUTH_COOKIE_NAMES = ['doai-auth', 'sb-access-token'] as const;

export default async function LandingPage() {
  const cookieStore = await cookies();
  const hasAuth = AUTH_COOKIE_NAMES.some((name) => cookieStore.get(name)?.value);
  if (hasAuth) redirect('/');

  const websiteStructuredData = generateWebsiteStructuredData(baseUrl);
  const personStructuredData = generatePersonStructuredData();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteStructuredData),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personStructuredData),
        }}
      />
      <HeroSection />
      <section id="cta" className="px-4 sm:px-6 py-12 border-t border-border/30">
        <div className="mx-auto max-w-7xl space-y-8">
          <h2 className="text-xl font-semibold tracking-tight">빠른 링크</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-lg border border-primary bg-primary/10 px-4 py-2 font-mono text-sm text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              대시보드
            </Link>
            <Link
              href="/runs"
              className="rounded-lg border border-border px-4 py-2 font-mono text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
            >
              Runs
            </Link>
            <Link
              href="/devices"
              className="rounded-lg border border-border px-4 py-2 font-mono text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
            >
              Devices
            </Link>
            <Link
              href="/dashboard/artifacts"
              className="rounded-lg border border-border px-4 py-2 font-mono text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
            >
              Artifacts
            </Link>
            <Link
              href="/dashboard/settings"
              className="rounded-lg border border-border px-4 py-2 font-mono text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
            >
              Settings
            </Link>
            <Link
              href="/health"
              className="rounded-lg border border-border px-4 py-2 font-mono text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
            >
              Health
            </Link>
            <Link
              href="/dashboard/workflows"
              className="rounded-lg border border-dashed border-border px-4 py-2 font-mono text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
            >
              Workflows (Stub)
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">오늘 실행 수</p>
              <p className="text-2xl font-semibold mt-1">—</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">활성 노드/디바이스</p>
              <p className="text-2xl font-semibold mt-1">—</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">최근 실패</p>
              <Link href="/runs" className="text-sm text-primary hover:underline mt-1 inline-block">Runs에서 확인</Link>
            </div>
          </div>
        </div>
      </section>
      <section id="overview" className="px-4 sm:px-6 py-12 border-t border-border/30">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-xl font-semibold tracking-tight mb-4">기타</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/blog" className="rounded-lg border border-border px-4 py-2 font-mono text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">블로그</Link>
            <Link href="/notes" className="rounded-lg border border-border px-4 py-2 font-mono text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">노트</Link>
            <Link href="/projects" className="rounded-lg border border-border px-4 py-2 font-mono text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">프로젝트</Link>
            <Link href="/workbench" className="rounded-lg border border-border px-4 py-2 font-mono text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">워크벤치</Link>
            <Link href="/introduction" className="rounded-lg border border-border px-4 py-2 font-mono text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">소개</Link>
          </div>
        </div>
      </section>
      <ProjectsGrid />
      <Workbench />
      <VideosSection />
      <LabNotes />
      <ArtifactsSection />
      <TechSection />
      <PhilosophySection />
    </>
  );
}
