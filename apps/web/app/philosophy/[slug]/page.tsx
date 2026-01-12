// app/philosophy/[slug]/page.tsx
// 철학 문서 상세 페이지

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Calendar, Tag, BookOpen } from 'lucide-react';
import {
  getPhilosophyDocumentBySlug,
  getPhilosophyDocuments,
  PHILOSOPHY_CATEGORIES,
  urlFor,
} from '@/lib/sanity/client';
import { ShareButton } from './ShareButton';

// ============================================
// 정적 경로 생성
// ============================================

export async function generateStaticParams() {
  const documents = await getPhilosophyDocuments();
  return documents.map((doc) => ({
    slug: doc.slug.current,
  }));
}

// ============================================
// 메타데이터 생성
// ============================================

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  // Next.js 15: params는 Promise를 반환하므로 await 필요
  const resolvedParams = await params;
  const document = await getPhilosophyDocumentBySlug(resolvedParams.slug);

  if (!document) {
    return {
      title: 'Document Not Found | DoAi.Me',
    };
  }

  return {
    title: `${document.title} | Philosophy Library`,
    description: document.excerpt,
    openGraph: {
      title: document.title,
      description: document.excerpt,
      type: 'article',
      publishedTime: document.publishedAt,
      authors: document.author?.name ? [document.author.name] : undefined,
    },
  };
}

// ============================================
// 메인 페이지 컴포넌트
// ============================================

export default async function PhilosophyDocumentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Next.js 15: params는 Promise를 반환하므로 await 필요
  const resolvedParams = await params;
  const document = await getPhilosophyDocumentBySlug(resolvedParams.slug);

  if (!document) {
    notFound();
  }

  const categoryLabel =
    PHILOSOPHY_CATEGORIES.find((c) => c.id === document.category)?.label ||
    document.category;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-neutral-950/90 backdrop-blur-sm border-b border-neutral-800">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/philosophy"
              className="flex items-center gap-2 text-sm text-neutral-400 hover:text-purple-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Library
            </Link>
            <ShareButton 
              title={document.title} 
              text={document.excerpt || document.title} 
            />
          </div>
        </div>
      </nav>

      {/* Article */}
      <article className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12">
          {/* Category */}
          <div className="flex items-center gap-3 mb-6">
            <span className="px-3 py-1 bg-purple-900/30 text-purple-300 text-sm font-medium rounded-full">
              {categoryLabel}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl lg:text-4xl font-bold mb-6 leading-tight">
            {document.title}
          </h1>

          {/* Excerpt */}
          {document.excerpt && (
            <p className="text-lg text-neutral-400 mb-8 leading-relaxed">
              {document.excerpt}
            </p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-neutral-500 pb-8 border-b border-neutral-800">
            {document.author?.name && (
              <div className="flex items-center gap-2">
                {document.author.image && (
                  <img
                    src={urlFor(document.author.image).width(32).height(32).url()}
                    alt={document.author.name}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-neutral-300">{document.author.name}</span>
              </div>
            )}
            {document.publishedAt && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  {new Date(document.publishedAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
            {document.readingTime && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{document.readingTime}분 읽기</span>
              </div>
            )}
          </div>
        </header>

        {/* Cover Image */}
        {document.coverImage && (
          <figure className="mb-12 -mx-6 lg:-mx-12">
            <img
              src={urlFor(document.coverImage).width(1200).height(600).url()}
              alt={document.title}
              className="w-full rounded-lg"
            />
          </figure>
        )}

        {/* Content */}
        <div className="prose prose-invert prose-purple max-w-none">
          {document.content ? (
            <PortableTextRenderer content={document.content} />
          ) : (
            <p className="text-neutral-400">이 문서의 내용이 아직 작성되지 않았습니다.</p>
          )}
        </div>

        {/* Tags */}
        {document.tags && document.tags.length > 0 && (
          <div className="mt-12 pt-8 border-t border-neutral-800">
            <h3 className="text-sm font-medium text-neutral-400 mb-4">태그</h3>
            <div className="flex flex-wrap gap-2">
              {document.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-neutral-300 text-sm rounded-lg border border-neutral-800"
                >
                  <Tag className="w-3.5 h-3.5" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Related Documents */}
        {document.relatedDocuments && document.relatedDocuments.length > 0 && (
          <section className="mt-12 pt-8 border-t border-neutral-800">
            <h3 className="flex items-center gap-2 text-lg font-semibold mb-6">
              <BookOpen className="w-5 h-5 text-purple-400" />
              관련 문서
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {document.relatedDocuments.map((related) => (
                <Link
                  key={related._id}
                  href={`/philosophy/${related.slug.current}`}
                  className="group p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg hover:border-purple-600/50 transition-colors"
                >
                  <h4 className="font-medium text-neutral-200 group-hover:text-purple-300 transition-colors mb-2">
                    {related.title}
                  </h4>
                  {related.excerpt && (
                    <p className="text-sm text-neutral-500 line-clamp-2">
                      {related.excerpt}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      {/* Footer */}
      <footer className="border-t border-neutral-800 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Link
            href="/philosophy"
            className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            라이브러리로 돌아가기
          </Link>
        </div>
      </footer>
    </div>
  );
}

// ============================================
// Portable Text 렌더러 (간단한 버전)
// ============================================

function PortableTextRenderer({ content }: { content: unknown[] }) {
  return (
    <div className="space-y-4">
      {content.map((block: unknown, index: number) => {
        const typedBlock = block as { _type: string; children?: Array<{ text: string }>; style?: string };
        
        if (typedBlock._type === 'block') {
          const text = typedBlock.children?.map((child) => child.text).join('') || '';
          
          switch (typedBlock.style) {
            case 'h2':
              return <h2 key={index} className="text-2xl font-bold mt-8 mb-4">{text}</h2>;
            case 'h3':
              return <h3 key={index} className="text-xl font-semibold mt-6 mb-3">{text}</h3>;
            case 'h4':
              return <h4 key={index} className="text-lg font-medium mt-4 mb-2">{text}</h4>;
            case 'blockquote':
              return (
                <blockquote key={index} className="border-l-4 border-purple-600 pl-4 py-2 italic text-neutral-300">
                  {text}
                </blockquote>
              );
            default:
              return <p key={index} className="text-neutral-300 leading-relaxed">{text}</p>;
          }
        }
        
        return null;
      })}
    </div>
  );
}
