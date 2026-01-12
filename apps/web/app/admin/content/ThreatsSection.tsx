'use client';

import { useState, useTransition } from 'react';
import { createThreatContent, updateThreatContent, deleteThreatContent } from '../actions';
import { Trash2, Edit2, X, Check } from 'lucide-react';

interface Threat {
  id: string;
  title: string;
  description: string;
  threat_type: string;
  severity: number;
  is_active: boolean;
  detected_count: number;
  last_detected_at: string | null;
  created_at: string;
}

interface ThreatsSectionProps {
  threats: Threat[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function ThreatsSection({
  threats,
  canCreate,
  canEdit,
  canDelete,
}: ThreatsSectionProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-neutral-400 text-sm">
          위협 콘텐츠 {threats.length}개
        </span>
        {canCreate && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 bg-red-900/50 text-red-300 rounded text-sm hover:bg-red-900 transition-colors"
          >
            + 위협 등록
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && canCreate && (
        <CreateThreatForm onClose={() => setShowForm(false)} />
      )}

      {/* Threats List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {threats.length === 0 ? (
          <div className="col-span-2 bg-neutral-900 border border-neutral-800 rounded-lg p-8 text-center text-neutral-500">
            등록된 위협 콘텐츠가 없습니다.
          </div>
        ) : (
          threats.map((threat) => (
            <ThreatCard 
              key={threat.id} 
              threat={threat} 
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
// Threat Card with Edit/Delete
// ============================================

function ThreatCard({ 
  threat,
  canEdit,
  canDelete,
}: { 
  threat: Threat;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [editTitle, setEditTitle] = useState(threat.title);
  const [editSeverity, setEditSeverity] = useState(threat.severity.toString());

  const severityColor =
    threat.severity >= 8 ? 'border-red-900 bg-red-950/30' :
    threat.severity >= 5 ? 'border-amber-900 bg-amber-950/30' :
    'border-neutral-800 bg-neutral-900';

  const handleUpdate = () => {
    const formData = new FormData();
    formData.set('title', editTitle);
    formData.set('severity', editSeverity);

    startTransition(async () => {
      try {
        await updateThreatContent(threat.id, formData);
        setIsEditing(false);
      } catch (error) {
        console.error('Update failed:', error);
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteThreatContent(threat.id);
      } catch (error) {
        console.error('Delete failed:', error);
        setIsDeleting(false);
      }
    });
  };

  return (
    <div className={`border rounded-lg p-4 ${severityColor}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          {isEditing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 mb-1"
            />
          ) : (
            <h3 className="text-neutral-200 font-medium">{threat.title}</h3>
          )}
          <span className="text-xs text-neutral-500">{threat.threat_type}</span>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <input
              type="number"
              min="1"
              max="10"
              value={editSeverity}
              onChange={(e) => setEditSeverity(e.target.value)}
              className="w-14 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
            />
          ) : (
            <SeverityBadge severity={threat.severity} />
          )}
        </div>
      </div>

      {threat.description && !isEditing && (
        <p className="text-neutral-400 text-sm mb-3 line-clamp-2">
          {threat.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-500">
          감지: <span className="text-neutral-300">{threat.detected_count}회</span>
        </span>
        <div className="flex items-center gap-2">
          <span className={threat.is_active ? 'text-emerald-500' : 'text-neutral-600'}>
            {threat.is_active ? 'Active' : 'Inactive'}
          </span>
          
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
                      setEditTitle(threat.title);
                      setEditSeverity(threat.severity.toString());
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
// Create Threat Form
// ============================================

function CreateThreatForm({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const threatTypes = ['copyright', 'hate', 'spam', 'competitor', 'impersonation', 'other'];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createThreatContent(formData);
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="threat-title-input" className="block text-neutral-400 text-xs mb-1">Title</label>
          <input
            id="threat-title-input"
            name="title"
            required
            placeholder="위협 콘텐츠 제목"
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-red-600"
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="threat-type-select" className="block text-neutral-400 text-xs mb-1">Type</label>
            <select
              id="threat-type-select"
              name="threat_type"
              required
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-red-600"
            >
              {threatTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label htmlFor="threat-severity-input" className="block text-neutral-400 text-xs mb-1">Severity</label>
            <input
              id="threat-severity-input"
              name="severity"
              type="number"
              min="1"
              max="10"
              defaultValue="5"
              required
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-red-600"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="threat-description-input" className="block text-neutral-400 text-xs mb-1">Description</label>
        <textarea
          id="threat-description-input"
          name="description"
          rows={3}
          placeholder="상세 설명"
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-red-600 resize-none"
        />
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
          className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {isPending ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}

// ============================================
// Severity Badge
// ============================================

function SeverityBadge({ severity }: { severity: number }) {
  const color =
    severity >= 8 ? 'bg-red-900 text-red-300' :
    severity >= 5 ? 'bg-amber-900 text-amber-300' :
    'bg-neutral-800 text-neutral-400';

  return (
    <span className={`px-2 py-0.5 text-xs rounded ${color}`}>
      S{severity}
    </span>
  );
}
