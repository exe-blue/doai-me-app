'use client';

import { useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { createEconomyContent, updateEconomyContent, deleteEconomyContent } from '../actions';
import { Trash2, Edit2, X, Check } from 'lucide-react';

interface EconomyContent {
  id: string;
  title: string;
  open_at: string;
  opened_at: string | null;
  closed_at: string | null;
  status: string;
  total_reward: number;
  participant_count: number;
  distributed_reward: number;
  created_at: string;
}

interface EconomySectionProps {
  contents: EconomyContent[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function EconomySection({
  contents,
  canCreate,
  canEdit,
  canDelete,
}: EconomySectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredContents = statusFilter === 'all'
    ? contents
    : contents.filter(c => c.status === statusFilter);

  const scheduled = contents.filter(c => c.status === 'scheduled');
  const open = contents.filter(c => c.status === 'open');
  const closed = contents.filter(c => c.status === 'closed');

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="예정" value={scheduled.length} color="purple" />
        <StatCard label="오픈 중" value={open.length} color="emerald" />
        <StatCard label="마감" value={closed.length} color="neutral" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-neutral-900 rounded-lg p-1">
          {['all', 'scheduled', 'open', 'closed'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                statusFilter === s
                  ? 'bg-neutral-700 text-neutral-200'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
        
        {canCreate && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 bg-yellow-900/50 text-yellow-300 rounded text-sm hover:bg-yellow-900 transition-colors"
          >
            + 경제 콘텐츠 생성
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && canCreate && (
        <CreateEconomyForm onClose={() => setShowForm(false)} />
      )}

      {/* Content List */}
      <div className="space-y-4">
        {filteredContents.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 text-center text-neutral-500">
            경제 콘텐츠가 없습니다.
          </div>
        ) : (
          filteredContents.map((content) => (
            <EconomyCard 
              key={content.id} 
              content={content}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================
// Economy Card with Edit/Delete
// ============================================

function EconomyCard({ 
  content,
  canEdit,
  canDelete,
}: { 
  content: EconomyContent;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [editTitle, setEditTitle] = useState(content.title);
  const [editReward, setEditReward] = useState(content.total_reward.toString());

  const isScheduled = content.status === 'scheduled';
  const isOpen = content.status === 'open';
  
  const openDate = new Date(content.open_at);
  const now = new Date();
  const timeUntilOpen = Math.max(0, openDate.getTime() - now.getTime());
  const hoursUntil = Math.floor(timeUntilOpen / 3600000);
  const minutesUntil = Math.floor((timeUntilOpen % 3600000) / 60000);

  const distributedPct = content.total_reward > 0
    ? (content.distributed_reward / content.total_reward) * 100
    : 0;

  const handleUpdate = () => {
    const formData = new FormData();
    formData.set('title', editTitle);
    formData.set('total_reward', editReward);

    startTransition(async () => {
      try {
        await updateEconomyContent(content.id, formData);
        setIsEditing(false);
      } catch (error) {
        console.error('Update failed:', error);
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteEconomyContent(content.id);
      } catch (error) {
        console.error('Delete failed:', error);
        setIsDeleting(false);
      }
    });
  };

  return (
    <div className={`bg-neutral-900 border rounded-lg p-4 ${
      isOpen ? 'border-emerald-900/50' :
      isScheduled ? 'border-purple-900/50' :
      'border-neutral-800'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          {isEditing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 mb-1"
            />
          ) : (
            <h3 className="text-neutral-200 font-medium">{content.title}</h3>
          )}
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={content.status} />
            {isScheduled && timeUntilOpen > 0 && (
              <span className="text-purple-400 text-xs">
                {hoursUntil}h {minutesUntil}m 후 오픈
              </span>
            )}
          </div>
        </div>
        
        <div className="text-right">
          {isEditing ? (
            <input
              type="number"
              value={editReward}
              onChange={(e) => setEditReward(e.target.value)}
              className="w-24 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 text-right"
            />
          ) : (
            <div className="text-yellow-400 font-mono">
              ₩{content.total_reward.toLocaleString()}
            </div>
          )}
          <div className="text-neutral-500 text-xs">
            {content.participant_count}명 참여
          </div>
        </div>
      </div>

      {/* Progress Bar (for open/closed) */}
      {(isOpen || content.status === 'closed') && !isEditing && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-neutral-500 mb-1">
            <span>분배 진행률</span>
            <span>{distributedPct.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${distributedPct}%` }}
              className={`h-full rounded-full ${
                content.status === 'closed' ? 'bg-neutral-600' : 'bg-emerald-500'
              }`}
            />
          </div>
        </div>
      )}

      {/* Time Info & Actions */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>
          오픈: {new Date(content.open_at).toLocaleString()}
        </span>
        
        <div className="flex items-center gap-2">
          {content.opened_at && (
            <span>
              실제 오픈: {new Date(content.opened_at).toLocaleString()}
            </span>
          )}
          
          {/* Actions */}
          {(canEdit || canDelete) && (
            <div className="flex gap-1 ml-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleUpdate}
                    disabled={isPending}
                    className="p-1 text-emerald-400 hover:bg-emerald-900/30 rounded transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditTitle(content.title);
                      setEditReward(content.total_reward.toString());
                    }}
                    className="p-1 text-neutral-400 hover:bg-neutral-800 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : isDeleting ? (
                <>
                  <button
                    onClick={handleDelete}
                    disabled={isPending}
                    className="px-2 py-0.5 text-red-400 hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                  >
                    {isPending ? '...' : '확인'}
                  </button>
                  <button
                    onClick={() => setIsDeleting(false)}
                    className="px-2 py-0.5 text-neutral-400 hover:bg-neutral-800 rounded transition-colors"
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  {canEdit && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-1 text-neutral-500 hover:text-amber-400 rounded transition-colors"
                      title="수정"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => setIsDeleting(true)}
                      className="p-1 text-neutral-500 hover:text-red-400 rounded transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Create Economy Form
// ============================================

function CreateEconomyForm({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createEconomyContent(formData);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create');
      }
    });
  };

  // Default: 1시간 후
  const defaultOpenAt = new Date(Date.now() + 3600000).toISOString().slice(0, 16);

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="economy_title" className="block text-neutral-400 text-xs mb-1">Title</label>
          <input
            id="economy_title"
            name="title"
            required
            placeholder="경제 콘텐츠 제목"
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-yellow-600"
          />
        </div>
        <div>
          <label htmlFor="total_reward" className="block text-neutral-400 text-xs mb-1">Total Reward</label>
          <input
            id="total_reward"
            name="total_reward"
            type="number"
            min="1"
            step="0.01"
            defaultValue="100"
            placeholder="총 보상 금액"
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-yellow-600"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="open_at" className="block text-neutral-400 text-xs mb-1">Open At</label>
          <input
            id="open_at"
            name="open_at"
            type="datetime-local"
            required
            defaultValue={defaultOpenAt}
            title="콘텐츠 오픈 일시"
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-yellow-600"
          />
        </div>
        <div>
          <label htmlFor="max_participants" className="block text-neutral-400 text-xs mb-1">Max Participants (optional)</label>
          <input
            id="max_participants"
            name="max_participants"
            type="number"
            min="1"
            placeholder="무제한"
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-yellow-600"
          />
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm">{error}</div>
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition-colors disabled:opacity-50"
        >
          {isPending ? '생성 중...' : '생성'}
        </button>
      </div>
    </form>
  );
}

// ============================================
// Status Badge
// ============================================

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    scheduled: 'bg-purple-950 text-purple-400',
    open: 'bg-emerald-950 text-emerald-400',
    closed: 'bg-neutral-800 text-neutral-500',
    cancelled: 'bg-red-950 text-red-400',
  };

  return (
    <span className={`px-2 py-0.5 text-xs rounded ${styles[status] || styles.closed}`}>
      {status}
    </span>
  );
}

// ============================================
// Stat Card
// ============================================

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'purple' | 'emerald' | 'neutral';
}) {
  const colors = {
    purple: 'border-purple-900/50 text-purple-400',
    emerald: 'border-emerald-900/50 text-emerald-400',
    neutral: 'border-neutral-800 text-neutral-400',
  };

  return (
    <div className={`bg-neutral-900 border rounded-lg p-4 ${colors[color]}`}>
      <div className="text-neutral-500 text-xs mb-1">{label}</div>
      <div className="text-2xl font-mono">{value}</div>
    </div>
  );
}
