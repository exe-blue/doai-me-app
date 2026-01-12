'use client';

// MembersTable - 일반 회원 목록 및 등급 관리
// 소유자만 등급 변경 가능

import { useState, useTransition } from 'react';
import { updateMemberTier } from '../actions';
import { ChevronDown, Check } from 'lucide-react';
import { TIER_DISPLAY_NAMES, type MembershipTier } from '@/lib/auth/types';

interface Member {
  id: string;
  user_id: string;
  tier: MembershipTier;
  display_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  users?: {
    email: string;
  };
}

interface MembersTableProps {
  members: Member[];
  canEdit: boolean;
}

export function MembersTable({ members, canEdit }: MembersTableProps) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      {members.length === 0 ? (
        <div className="p-8 text-center text-neutral-500">
          등록된 회원이 없습니다.
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500 font-mono">
              <th className="px-4 py-3">USER</th>
              <th className="px-4 py-3">TIER</th>
              <th className="px-4 py-3">NOTES</th>
              <th className="px-4 py-3">REGISTERED</th>
              {canEdit && <th className="px-4 py-3 text-right">ACTIONS</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <MemberRow 
                key={member.id} 
                member={member} 
                canEdit={canEdit}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ============================================
// Member Row
// ============================================

function MemberRow({ member, canEdit }: { member: Member; canEdit: boolean }) {
  const [isChangingTier, setIsChangingTier] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedTier, setSelectedTier] = useState<MembershipTier>(member.tier);

  const tierColor: Record<MembershipTier, string> = {
    associate: 'bg-neutral-800 text-neutral-400',
    regular: 'bg-blue-900/50 text-blue-300',
    special: 'bg-purple-900/50 text-purple-300',
  };

  const handleTierChange = (newTier: MembershipTier) => {
    setSelectedTier(newTier);
    
    startTransition(async () => {
      try {
        await updateMemberTier(member.user_id, newTier);
        setIsChangingTier(false);
      } catch (error) {
        console.error('Tier update failed:', error);
        setSelectedTier(member.tier);
      }
    });
  };

  return (
    <tr className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
      <td className="px-4 py-3">
        <div className="text-neutral-200 text-sm">
          {member.display_name || 'Unknown'}
        </div>
        <div className="text-neutral-500 text-xs">
          {member.users?.email || member.user_id}
        </div>
      </td>
      <td className="px-4 py-3">
        {isChangingTier ? (
          <div className="flex items-center gap-2">
            <select
              value={selectedTier}
              onChange={(e) => handleTierChange(e.target.value as MembershipTier)}
              disabled={isPending}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
              aria-label="회원 등급 선택"
            >
              {(['associate', 'regular', 'special'] as MembershipTier[]).map((tier) => (
                <option key={tier} value={tier}>
                  {TIER_DISPLAY_NAMES[tier]}
                </option>
              ))}
            </select>
            <button
              onClick={() => setIsChangingTier(false)}
              className="text-neutral-500 hover:text-neutral-300 text-xs"
            >
              취소
            </button>
          </div>
        ) : (
          <span className={`px-2 py-1 text-xs rounded ${tierColor[member.tier]}`}>
            {TIER_DISPLAY_NAMES[member.tier]}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-neutral-500 text-sm">
          {member.notes || '-'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-neutral-500 text-xs">
          {new Date(member.created_at).toLocaleDateString()}
        </span>
      </td>
      {canEdit && (
        <td className="px-4 py-3 text-right">
          {!isChangingTier && (
            <button
              onClick={() => setIsChangingTier(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-amber-400 hover:bg-amber-900/30 rounded transition-colors ml-auto"
            >
              등급 변경
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </td>
      )}
    </tr>
  );
}
