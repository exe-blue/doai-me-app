import { notFound } from 'next/navigation';
import { getPostBySlug } from '@/lib/blog-data';
import { BlogPostContent } from '@/components/public/blog/blog-post-content';
import { generateBlogPostStructuredData } from '@/lib/structured-data';
import type { Metadata } from 'next';

interface BlogPostPageProps {
  params: Promise<{ postSlug: string }>;
}

export async function generateStaticParams() {
  const { blogPosts } = await import('@/lib/blog-data');
  return blogPosts.map((post: { slug: string }) => ({ postSlug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { postSlug } = await params;
  const post = getPostBySlug(postSlug);
  if (!post)
    return { title: 'Post Not Found' };
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://doai.me';
  const postUrl = `${baseUrl}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { url: postUrl, title: post.title, description: post.excerpt },
    alternates: { canonical: postUrl },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { postSlug } = await params;
  const post = getPostBySlug(postSlug);
  if (!post) notFound();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://doai.me';
  const structuredData = generateBlogPostStructuredData(post, baseUrl);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div>
        <BlogPostContent post={post} />
      </div>
    </>
  );
}
