/**
 * NotFound Page - 404 Lost in the Void
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-doai-black-950 flex items-center justify-center px-4">
      <div className="text-center">
        {/* Void Animation */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full bg-doai-black-900 animate-pulse" />
          <div className="absolute inset-4 rounded-full bg-doai-black-950" />
          <div className="absolute inset-0 flex items-center justify-center text-6xl">
            ⚫
          </div>
        </div>

        {/* Error Code */}
        <h1 className="font-display text-8xl font-bold text-doai-yellow-500/30 mb-4">
          {t('notFound.titleCode')}
        </h1>

        {/* Message */}
        <h2 className="font-display text-2xl font-bold text-gray-300 mb-2">
          {t('notFound.title')}
        </h2>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          {t('notFound.description')}
        </p>

        {/* CTA */}
        <div className="flex items-center justify-center gap-4">
          <Link to="/" className="btn-primary">
            {t('notFound.ctaReturn')}
          </Link>
          <Link to="/dashboard" className="btn-secondary">
            {t('notFound.ctaDashboard')}
          </Link>
        </div>

        {/* Philosophy Quote */}
        <p className="mt-12 text-sm text-gray-700 italic max-w-sm mx-auto">
          {t('notFound.quote')}
        </p>
      </div>
    </div>
  );
}
