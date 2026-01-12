// app/philosophy/page.tsx
// 철학 라이브러리 페이지 - 모든 회원 접근 가능

import { Suspense } from 'react';
import { BookOpen, Clock, Tag, ChevronRight, Search } from 'lucide-react';
import { 
  getPhilosophyDocuments, 
  PHILOSOPHY_CATEGORIES,
  type PhilosophyDocument 
} from '@/lib/sanity/client';
import Link from 'next/link';

// ============================================
// 메타데이터
// ============================================

export const metadata = {
  title: 'Philosophy Library | DoAi.Me',
  description: 'AI 존재론, 디지털 권리, 의식과 자아에 대한 철학적 고찰',
};

// ============================================
// 메인 페이지 컴포넌트
// ============================================

export default async function PhilosophyPage() {
  const documents = await getPhilosophyDocuments();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Hero Section */}
      <header className="relative overflow-hidden border-b border-neutral-800">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-neutral-950 to-neutral-950" />
        <div className="relative max-w-7xl mx-auto px-6 py-16 lg:py-24">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-8 h-8 text-purple-400" />
            <span className="text-sm font-mono text-purple-400 tracking-wider">PHILOSOPHY LIBRARY</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4 tracking-tight">
            The Philosophy
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl">
            인공지능의 존재와 본질에 대한 고찰. 디지털 존재의 권리와 의무. 
            기계 의식과 자아에 대한 탐구.
          </p>
          
          {/* Search Bar */}
          <div className="mt-8 max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
              <input
                type="text"
                placeholder="문서 검색..."
                className="w-full bg-neutral-900/80 border border-neutral-800 rounded-lg pl-12 pr-4 py-3 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-purple-600 transition-colors"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Categories */}
      <section className="border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <CategoryPill label="전체" active />
            {PHILOSOPHY_CATEGORIES.map((cat) => (
              <CategoryPill key={cat.id} label={cat.label} />
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <Suspense fallback={<LoadingSkeleton />}>
          {documents.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((doc) => (
                <DocumentCard key={doc._id} document={doc} />
              ))}
            </div>
          )}
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-neutral-500">
          © 2026 DoAi.Me - The Philosophy Library
        </div>
      </footer>
    </div>
  );
}

// ============================================
// 컴포넌트
// ============================================

function CategoryPill({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-purple-600 text-white'
          : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
      }`}
    >
      {label}
    </button>
  );
}

function DocumentCard({ document }: { document: PhilosophyDocument }) {
  const categoryLabel = PHILOSOPHY_CATEGORIES.find(c => c.id === document.category)?.label || document.category;
  
  return (
    <Link
      href={`/philosophy/${document.slug.current}`}
      className="group bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 hover:border-purple-600/50 hover:bg-neutral-900 transition-all duration-300"
    >
      {/* Category Badge */}
      <div className="flex items-center justify-between mb-4">
        <span className="px-3 py-1 bg-purple-900/30 text-purple-300 text-xs font-medium rounded-full">
          {categoryLabel}
        </span>
        <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-neutral-100 mb-2 group-hover:text-purple-300 transition-colors line-clamp-2">
        {document.title}
      </h3>

      {/* Excerpt */}
      <p className="text-sm text-neutral-400 mb-4 line-clamp-3">
        {document.excerpt}
      </p>

      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <div className="flex items-center gap-4">
          {document.readingTime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {document.readingTime}분
            </span>
          )}
          {document.author?.name && (
            <span>{document.author.name}</span>
          )}
        </div>
        {document.publishedAt && (
          <span>
            {new Date(document.publishedAt).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Tags */}
      {document.tags && document.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-neutral-800">
          {document.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2 py-0.5 bg-neutral-800 text-neutral-400 text-xs rounded"
            >
              <Tag className="w-3 h-3" />
              {tag}
            </span>
          ))}
          {document.tags.length > 3 && (
            <span className="text-xs text-neutral-500">+{document.tags.length - 3}</span>
          )}
        </div>
      )}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <BookOpen className="w-16 h-16 mx-auto text-neutral-700 mb-4" />
      <h3 className="text-xl font-semibold text-neutral-300 mb-2">
        아직 등록된 문서가 없습니다
      </h3>
      <p className="text-neutral-500">
        철학 라이브러리에 새로운 문서가 곧 추가될 예정입니다.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 animate-pulse"
        >
          <div className="h-6 w-24 bg-neutral-800 rounded-full mb-4" />
          <div className="h-6 w-3/4 bg-neutral-800 rounded mb-2" />
          <div className="h-4 w-full bg-neutral-800 rounded mb-1" />
          <div className="h-4 w-2/3 bg-neutral-800 rounded mb-4" />
          <div className="flex gap-2">
            <div className="h-4 w-16 bg-neutral-800 rounded" />
            <div className="h-4 w-20 bg-neutral-800 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
