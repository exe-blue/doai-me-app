import { WorkbenchPageContent } from '@/components/public/workbench/workbench-page-content';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '워크벤치',
  description: 'Experiments and work in progress.',
};

export default function WorkbenchPage() {
  return (
    <div className="px-4 sm:px-6 pt-24 pb-16">
      <WorkbenchPageContent />
    </div>
  );
}
