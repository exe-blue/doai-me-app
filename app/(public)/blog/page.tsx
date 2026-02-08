import { BlogHero } from '@/components/public/blog/blog-hero';
import { BlogList } from '@/components/public/blog/blog-list';
import { BlogSidebar } from '@/components/public/blog/blog-sidebar';
import type { Metadata } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://doai.me';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Technical articles, experiments, and insights. DoAi.Me digital laboratory.',
  openGraph: {
    title: 'Blog — DoAi.Me',
    description: 'Technical articles and insights from the digital laboratory.',
    url: `${baseUrl}/blog`,
    type: 'website',
  },
  alternates: { canonical: `${baseUrl}/blog` },
};

export default function BlogPage() {
  return (
    <div>
      <BlogHero />
      <section className="px-4 sm:px-6 py-16 sm:py-20 border-t border-border/30">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
            <BlogList />
            <BlogSidebar />
          </div>
        </div>
      </section>
    </div>
  );
}
