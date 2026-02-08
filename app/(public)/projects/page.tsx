import { ProjectsPageContent } from '@/components/public/projects/projects-page-content';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '프로젝트',
  description: 'DoAi.Me projects and experiments.',
};

export default function ProjectsPage() {
  return (
    <div className="px-4 sm:px-6 pt-24 pb-16">
      <ProjectsPageContent />
    </div>
  );
}
