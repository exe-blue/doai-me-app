// apps/web/app/work/components/RegisterVideoForm.tsx
// YouTube 영상 등록 폼

'use client';

import { useState } from 'react';
import { Youtube, Loader2, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchVideoInfo as fetchVideoInfoAction, registerVideo } from '../actions';

interface VideoInfo {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: string;
  channelTitle: string;
}

export function RegisterVideoForm() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 영상 정보 조회
  const handleFetchVideoInfo = async () => {
    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setVideoInfo(null);

    try {
      const result = await fetchVideoInfoAction(url);

      if (!result.success || !result.data) {
        setError(result.error || 'Failed to fetch video info');
        return;
      }

      setVideoInfo(result.data);
    } catch {
      setError('Failed to fetch video info');
    } finally {
      setIsLoading(false);
    }
  };

  // 영상 등록
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoInfo) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await registerVideo({
        videoId: videoInfo.videoId,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        channelTitle: videoInfo.channelTitle,
        duration: videoInfo.duration,
      });

      if (!result.success) {
        setError(result.error || 'Failed to register video');
        return;
      }

      setSuccess(true);
      setUrl('');
      setVideoInfo(null);

      // 3초 후 성공 메시지 제거
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Failed to register video');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* URL Input */}
        <div>
          <label className="block text-sm text-neutral-400 mb-2">
            YouTube URL
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className={cn(
                  "w-full pl-11 pr-4 py-3 bg-black/50 border rounded-lg",
                  "text-white placeholder:text-neutral-600",
                  "focus:outline-none focus:ring-2 focus:ring-[#FFCC00]/50",
                  error ? "border-red-500/50" : "border-white/10"
                )}
              />
            </div>
            <button
              type="button"
              onClick={handleFetchVideoInfo}
              disabled={!url || isLoading}
              className={cn(
                "px-4 py-3 rounded-lg font-mono text-sm uppercase",
                "border border-white/20 bg-white/5",
                "hover:bg-white/10 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center gap-2"
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Fetch
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {error}
            </p>
          )}
        </div>

        {/* Video Preview */}
        {videoInfo && (
          <div className="bg-black/30 rounded-lg p-4 border border-white/10">
            <div className="flex gap-4">
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="w-32 h-20 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white truncate">
                  {videoInfo.title}
                </h3>
                <p className="text-sm text-neutral-400 mt-1">
                  {videoInfo.channelTitle}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Duration: {videoInfo.duration}
                </p>
              </div>
            </div>

            {/* Search Method Info */}
            <div className="mt-4 p-3 bg-[#FFCC00]/10 rounded border border-[#FFCC00]/20">
              <p className="text-sm text-[#FFCC00] flex items-center gap-2">
                <Search className="w-4 h-4" />
                <span>
                  Devices will search by title: &quot;{videoInfo.title}&quot;
                </span>
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Human-like behavior: Random wait → Search by title → Watch video
              </p>
            </div>
          </div>
        )}

        {/* Device Target Info */}
        <div className="p-4 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400">Target Devices</span>
            <span className="font-mono text-[#FFCC00]">100% (All Devices)</span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            All available devices will watch this video
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!videoInfo || isSubmitting}
          className={cn(
            "w-full py-4 rounded-lg font-mono text-sm uppercase tracking-wider",
            "border transition-all duration-300",
            "flex items-center justify-center gap-2",
            videoInfo && !isSubmitting
              ? "border-[#FFCC00] bg-[#FFCC00]/10 text-[#FFCC00] hover:bg-[#FFCC00] hover:text-black"
              : "border-white/10 bg-white/5 text-neutral-500 cursor-not-allowed"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Registering...
            </>
          ) : (
            <>
              <Youtube className="w-4 h-4" />
              Register Video
            </>
          )}
        </button>

        {/* Success Message */}
        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-green-400 font-medium">Video Registered!</p>
              <p className="text-sm text-green-400/70">
                Devices will start watching shortly
              </p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
