'use client';

import { useState, useTransition } from 'react';
import { createChannel, updateChannel, deleteChannel } from '../actions';
import { Trash2, Edit2, X, Check } from 'lucide-react';

interface Channel {
  id: string;
  channel_code: string;
  title: string;
  priority: number;
  is_active: boolean;
  video_count: number;
  last_polled_at: string | null;
}

interface ChannelsSectionProps {
  channels: Channel[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function ChannelsSection({
  channels,
  canCreate,
  canEdit,
  canDelete,
}: ChannelsSectionProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-neutral-400 text-sm">
          등록된 채널 {channels.length}개
        </span>
        {canCreate && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 bg-purple-900/50 text-purple-300 rounded text-sm hover:bg-purple-900 transition-colors"
          >
            + 채널 등록
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && canCreate && (
        <CreateChannelForm onClose={() => setShowForm(false)} />
      )}

      {/* Channels List */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
        {channels.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            등록된 채널이 없습니다.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500 font-mono">
                <th className="px-4 py-3">CHANNEL</th>
                <th className="px-4 py-3">PRIORITY</th>
                <th className="px-4 py-3">VIDEOS</th>
                <th className="px-4 py-3">LAST POLL</th>
                <th className="px-4 py-3">STATUS</th>
                {(canEdit || canDelete) && (
                  <th className="px-4 py-3 text-right">ACTIONS</th>
                )}
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ============================================
// Channel Row with Edit/Delete
// ============================================

function ChannelRow({
  channel,
  canEdit,
  canDelete,
}: {
  channel: Channel;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [editTitle, setEditTitle] = useState(channel.title);
  const [editPriority, setEditPriority] = useState(channel.priority.toString());

  const handleUpdate = () => {
    const formData = new FormData();
    formData.set('title', editTitle);
    formData.set('priority', editPriority);

    startTransition(async () => {
      try {
        await updateChannel(channel.id, formData);
        setIsEditing(false);
      } catch (error) {
        console.error('Update failed:', error);
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteChannel(channel.id);
      } catch (error) {
        console.error('Delete failed:', error);
        setIsDeleting(false);
      }
    });
  };

  return (
    <tr className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
      <td className="px-4 py-3">
        {isEditing ? (
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200"
          />
        ) : (
          <>
            <div className="text-neutral-200 text-sm">{channel.title}</div>
            <div className="text-neutral-500 text-xs font-mono">
              {channel.channel_code}
            </div>
          </>
        )}
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <input
            type="number"
            min="1"
            max="10"
            value={editPriority}
            onChange={(e) => setEditPriority(e.target.value)}
            className="w-16 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200"
          />
        ) : (
          <PriorityBadge priority={channel.priority} />
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-neutral-400 text-sm">{channel.video_count}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-neutral-500 text-xs">
          {channel.last_polled_at
            ? new Date(channel.last_polled_at).toLocaleString()
            : 'Never'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`px-2 py-0.5 text-xs rounded ${
            channel.is_active
              ? 'bg-emerald-950 text-emerald-400'
              : 'bg-neutral-800 text-neutral-500'
          }`}
        >
          {channel.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      {(canEdit || canDelete) && (
        <td className="px-4 py-3">
          <div className="flex gap-1 justify-end">
            {isEditing ? (
              <>
                <button
                  onClick={handleUpdate}
                  disabled={isPending}
                  className="p-1.5 text-emerald-400 hover:bg-emerald-900/30 rounded transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditTitle(channel.title);
                    setEditPriority(channel.priority.toString());
                  }}
                  className="p-1.5 text-neutral-400 hover:bg-neutral-800 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : isDeleting ? (
              <>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="px-2 py-1 text-xs text-red-400 hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                >
                  {isPending ? '삭제 중...' : '확인'}
                </button>
                <button
                  onClick={() => setIsDeleting(false)}
                  className="px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 rounded transition-colors"
                >
                  취소
                </button>
              </>
            ) : (
              <>
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded transition-colors"
                    title="수정"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => setIsDeleting(true)}
                    className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

// ============================================
// Create Channel Form
// ============================================

function CreateChannelForm({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createChannel(formData);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create');
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="channel-code-input" className="block text-neutral-400 text-xs mb-1">Channel ID</label>
          <input
            id="channel-code-input"
            name="channel_code"
            required
            placeholder="UCxxxxxxxxxx"
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-purple-600"
          />
        </div>
        <div>
          <label htmlFor="channel-title-input" className="block text-neutral-400 text-xs mb-1">Title</label>
          <input
            id="channel-title-input"
            name="title"
            required
            placeholder="채널명"
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-purple-600"
          />
        </div>
        <div>
          <label htmlFor="channel-priority-input" className="block text-neutral-400 text-xs mb-1">Priority (1-10)</label>
          <input
            id="channel-priority-input"
            name="priority"
            type="number"
            min="1"
            max="10"
            defaultValue="5"
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-purple-600"
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
          className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {isPending ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}

// ============================================
// Priority Badge
// ============================================

function PriorityBadge({ priority }: { priority: number }) {
  const color =
    priority >= 8 ? 'text-amber-400' :
    priority >= 5 ? 'text-neutral-300' :
    'text-neutral-500';

  return (
    <span className={`font-mono text-sm ${color}`}>
      P{priority}
    </span>
  );
}
