import { NotesPageContent } from '@/components/public/notes/notes-page-content';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '노트',
  description: 'Lab notes and technical insights.',
};

export default function NotesPage() {
  return (
    <div className="px-4 sm:px-6 pt-24 pb-16">
      <NotesPageContent />
    </div>
  );
}
