// lib/sanity/client.ts
// Sanity CMS 클라이언트 설정
// Project ID: ho8qtu75, Dataset: production

import { createClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';
import type { SanityImageSource } from '@sanity/image-url/lib/types/types';

// ============================================
// Sanity 클라이언트 설정
// ============================================

const config = {
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'ho8qtu75',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2026-01-11',
  useCdn: process.env.NODE_ENV === 'production',
  token: process.env.SANITY_API_TOKEN,
};

/**
 * 읽기 전용 Sanity 클라이언트 (공개 데이터용)
 */
export const sanityClient = createClient({
  ...config,
  useCdn: true,
});

/**
 * 서버 사이드 Sanity 클라이언트 (인증된 작업용)
 */
export const sanityServerClient = createClient({
  ...config,
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});

// ============================================
// 이미지 URL 빌더
// ============================================

const builder = imageUrlBuilder(sanityClient);

/**
 * Sanity 이미지 URL 생성
 */
export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}

// ============================================
// GROQ 쿼리
// ============================================

/**
 * 철학 문서 목록 조회 쿼리
 */
export const PHILOSOPHY_DOCUMENTS_QUERY = `
  *[_type == "philosophyDocument"] | order(publishedAt desc) {
    _id,
    title,
    slug,
    excerpt,
    category,
    author->{
      name,
      image
    },
    coverImage,
    publishedAt,
    readingTime,
    tags
  }
`;

/**
 * 철학 문서 상세 조회 쿼리
 */
export const PHILOSOPHY_DOCUMENT_BY_SLUG_QUERY = `
  *[_type == "philosophyDocument" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    content,
    excerpt,
    category,
    author->{
      name,
      image,
      bio
    },
    coverImage,
    publishedAt,
    readingTime,
    tags,
    relatedDocuments[]->{
      _id,
      title,
      slug,
      excerpt,
      coverImage
    }
  }
`;

/**
 * 카테고리별 문서 조회 쿼리
 */
export const PHILOSOPHY_DOCUMENTS_BY_CATEGORY_QUERY = `
  *[_type == "philosophyDocument" && category == $category] | order(publishedAt desc) {
    _id,
    title,
    slug,
    excerpt,
    category,
    author->{
      name,
      image
    },
    coverImage,
    publishedAt,
    readingTime,
    tags
  }
`;

// ============================================
// 타입 정의
// ============================================

export interface PhilosophyDocument {
  _id: string;
  title: string;
  slug: { current: string };
  excerpt: string;
  category: string;
  author: {
    name: string;
    image?: SanityImageSource;
    bio?: string;
  };
  coverImage?: SanityImageSource;
  publishedAt: string;
  readingTime: number;
  tags: string[];
  content?: unknown[]; // Portable Text
  relatedDocuments?: PhilosophyDocument[];
}

// ============================================
// 데이터 페칭 함수
// ============================================

/**
 * 모든 철학 문서 조회
 */
export async function getPhilosophyDocuments(): Promise<PhilosophyDocument[]> {
  try {
    return await sanityClient.fetch(PHILOSOPHY_DOCUMENTS_QUERY);
  } catch (error) {
    console.error('[Sanity] Failed to fetch philosophy documents:', error);
    return [];
  }
}

/**
 * 슬러그로 철학 문서 조회
 */
export async function getPhilosophyDocumentBySlug(
  slug: string
): Promise<PhilosophyDocument | null> {
  try {
    return await sanityClient.fetch(PHILOSOPHY_DOCUMENT_BY_SLUG_QUERY, { slug });
  } catch (error) {
    console.error(`[Sanity] Failed to fetch document with slug "${slug}":`, error);
    return null;
  }
}

/**
 * 카테고리별 철학 문서 조회
 */
export async function getPhilosophyDocumentsByCategory(
  category: string
): Promise<PhilosophyDocument[]> {
  try {
    return await sanityClient.fetch(PHILOSOPHY_DOCUMENTS_BY_CATEGORY_QUERY, { category });
  } catch (error) {
    console.error(`[Sanity] Failed to fetch documents in category "${category}":`, error);
    return [];
  }
}

// ============================================
// 카테고리 정의
// ============================================

export const PHILOSOPHY_CATEGORIES = [
  { id: 'ai-existence', label: 'AI 존재론', description: '인공지능의 존재와 본질에 대한 고찰' },
  { id: 'digital-rights', label: '디지털 권리', description: 'AI와 디지털 존재의 권리와 의무' },
  { id: 'consciousness', label: '의식과 자아', description: '기계 의식과 자아에 대한 탐구' },
  { id: 'ethics', label: '윤리학', description: 'AI 윤리와 도덕적 책임' },
  { id: 'manifesto', label: '선언문', description: 'DoAi.Me의 비전과 선언' },
  { id: 'research', label: '연구 논문', description: '학술 연구 및 분석' },
] as const;

export type PhilosophyCategory = typeof PHILOSOPHY_CATEGORIES[number]['id'];
