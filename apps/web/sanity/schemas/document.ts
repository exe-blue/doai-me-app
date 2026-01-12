// sanity/schemas/document.ts
// Sanity CMS 스키마 정의 - 철학 문서 라이브러리

/**
 * 철학 문서 스키마
 * 
 * 주요 필드:
 * - title: 문서 제목
 * - slug: URL 슬러그
 * - content: Portable Text (리치 텍스트)
 * - category: 문서 카테고리
 * - author: 저자 참조
 */
export const philosophyDocument = {
  name: 'philosophyDocument',
  title: 'Philosophy Document',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule: { required: () => unknown }) => Rule.required(),
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule: { required: () => unknown }) => Rule.required(),
    },
    {
      name: 'excerpt',
      title: 'Excerpt',
      type: 'text',
      rows: 3,
      description: '문서 요약 (목록에 표시됨)',
    },
    {
      name: 'content',
      title: 'Content',
      type: 'array',
      of: [
        {
          type: 'block',
          styles: [
            { title: 'Normal', value: 'normal' },
            { title: 'H2', value: 'h2' },
            { title: 'H3', value: 'h3' },
            { title: 'H4', value: 'h4' },
            { title: 'Quote', value: 'blockquote' },
          ],
          marks: {
            decorators: [
              { title: 'Bold', value: 'strong' },
              { title: 'Italic', value: 'em' },
              { title: 'Code', value: 'code' },
            ],
            annotations: [
              {
                name: 'link',
                type: 'object',
                title: 'Link',
                fields: [
                  {
                    name: 'href',
                    type: 'url',
                    title: 'URL',
                  },
                ],
              },
            ],
          },
        },
        {
          type: 'image',
          options: { hotspot: true },
        },
        {
          type: 'code',
          title: 'Code Block',
          options: {
            language: 'javascript',
            languageAlternatives: [
              { title: 'JavaScript', value: 'javascript' },
              { title: 'TypeScript', value: 'typescript' },
              { title: 'Python', value: 'python' },
              { title: 'SQL', value: 'sql' },
              { title: 'JSON', value: 'json' },
            ],
          },
        },
      ],
    },
    {
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'AI 존재론', value: 'ai-existence' },
          { title: '디지털 권리', value: 'digital-rights' },
          { title: '의식과 자아', value: 'consciousness' },
          { title: '윤리학', value: 'ethics' },
          { title: '선언문', value: 'manifesto' },
          { title: '연구 논문', value: 'research' },
        ],
      },
      validation: (Rule: { required: () => unknown }) => Rule.required(),
    },
    {
      name: 'author',
      title: 'Author',
      type: 'reference',
      to: [{ type: 'author' }],
    },
    {
      name: 'coverImage',
      title: 'Cover Image',
      type: 'image',
      options: { hotspot: true },
    },
    {
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
    },
    {
      name: 'readingTime',
      title: 'Reading Time (minutes)',
      type: 'number',
      validation: (Rule: { min: (n: number) => unknown }) => Rule.min(1),
    },
    {
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        layout: 'tags',
      },
    },
    {
      name: 'relatedDocuments',
      title: 'Related Documents',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [{ type: 'philosophyDocument' }],
        },
      ],
    },
  ],
  preview: {
    select: {
      title: 'title',
      author: 'author.name',
      media: 'coverImage',
      category: 'category',
    },
    prepare(selection: { title: string; author: string; category: string; media: unknown }) {
      const { title, author, category } = selection;
      return {
        title,
        subtitle: `${category || 'No category'} | ${author || 'No author'}`,
        media: selection.media,
      };
    },
  },
};

/**
 * 저자 스키마
 */
export const author = {
  name: 'author',
  title: 'Author',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (Rule: { required: () => unknown }) => Rule.required(),
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'name',
        maxLength: 96,
      },
    },
    {
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
    },
    {
      name: 'bio',
      title: 'Bio',
      type: 'text',
      rows: 4,
    },
  ],
  preview: {
    select: {
      title: 'name',
      media: 'image',
    },
  },
};

// 스키마 목록
export const schemaTypes = [philosophyDocument, author];
