'use client';

// AdminUsersTable - 관리자 목록 및 역할 관리
// 소유자만 역할 변경 가능 (본인 제외)

import { useState, useTransition } from 'react';
import { updateAdminRole } from '../actions';
import { ChevronDown, AlertCircle } from 'lucide-react';
import { ROLE_DISPLAY_NAMES, type AdminRole } from '@/lib/auth/types';

interface AdminUser {
  id: string;
  user_id: string;
  role: AdminRole;
  email?: string;
  created_at?: string;
}

interface AdminUsersTableProps {
  adminUsers: AdminUser[];
  canEdit: boolean;
  currentUserId: string | null;
}

export function AdminUsersTable({ adminUsers, canEdit, currentUserId }: AdminUsersTableProps) {
  return (
    <div className="space-y-4">
      {/* Warning */}
      {canEdit && (
        <div className="flex items-start gap-3 p-4 bg-amber-900/20 border border-amber-900/50 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="text-amber-300 font-medium mb-1">역할 변경 주의</div>
            <div className="text-amber-400/80">
              관리자 역할을 변경하면 해당 사용자의 접근 권한이 즉시 변경됩니다.
              본인의 역할은 변경할 수 없습니다.
            </div>
          </div>
        </div>
      )}

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
        {adminUsers.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            등록된 관리자가 없습니다.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500 font-mono">
                <th className="px-4 py-3">ADMIN</th>
                <th className="px-4 py-3">ROLE</th>
                <th className="px-4 py-3">REGISTERED</th>
                {canEdit && <th className="px-4 py-3 text-right">ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {adminUsers.map((admin) => (
                <AdminRow 
                  key={admin.id} 
                  admin={admin} 
                  canEdit={canEdit}
                  isCurrentUser={admin.user_id === currentUserId}
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
// Admin Row
// ============================================

function AdminRow({ 
  admin, 
  canEdit,
  isCurrentUser,
}: { 
  admin: AdminUser; 
  canEdit: boolean;
  isCurrentUser: boolean;
}) {
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedRole, setSelectedRole] = useState<AdminRole>(admin.role);

  const roleColor: Record<AdminRole, string> = {
    pending: 'bg-neutral-800 text-neutral-500',
    viewer: 'bg-blue-900/50 text-blue-300',
    admin: 'bg-purple-900/50 text-purple-300',
    owner: 'bg-amber-900/50 text-amber-300',
  };

  const handleRoleChange = (newRole: AdminRole) => {
    setSelectedRole(newRole);
    
    startTransition(async () => {
      try {
        await updateAdminRole(admin.user_id, newRole);
        setIsChangingRole(false);
      } catch (error) {
        console.error('Role update failed:', error);
        setSelectedRole(admin.role);
      }
    });
  };

  const canChangeThisUser = canEdit && !isCurrentUser;

  return (
    <tr className={`border-b border-neutral-800/50 transition-colors ${
      isCurrentUser ? 'bg-purple-900/10' : 'hover:bg-neutral-800/30'
    }`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="text-neutral-200 text-sm">
            {admin.email || admin.user_id}
          </div>
          {isCurrentUser && (
            <span className="px-1.5 py-0.5 text-[10px] bg-purple-900/50 text-purple-300 rounded">
              YOU
            </span>
          )}
        </div>
        <div className="text-neutral-500 text-xs font-mono">
          {admin.user_id.slice(0, 8)}...
        </div>
      </td>
      <td className="px-4 py-3">
        {isChangingRole ? (
          <div className="flex items-center gap-2">
            <select
              value={selectedRole}
              onChange={(e) => handleRoleChange(e.target.value as AdminRole)}
              disabled={isPending}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
              aria-label="관리자 역할 선택"
            >
              {(['pending', 'viewer', 'admin', 'owner'] as AdminRole[]).map((role) => (
                <option key={role} value={role}>
                  {ROLE_DISPLAY_NAMES[role]}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setIsChangingRole(false);
                setSelectedRole(admin.role);
              }}
              className="text-neutral-500 hover:text-neutral-300 text-xs"
            >
              취소
            </button>
          </div>
        ) : (
          <span className={`px-2 py-1 text-xs rounded ${roleColor[admin.role]}`}>
            {ROLE_DISPLAY_NAMES[admin.role]}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-neutral-500 text-xs">
          {admin.created_at 
            ? new Date(admin.created_at).toLocaleDateString()
            : '-'
          }
        </span>
      </td>
      {canEdit && (
        <td className="px-4 py-3 text-right">
          {canChangeThisUser && !isChangingRole && (
            <button
              onClick={() => setIsChangingRole(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-amber-400 hover:bg-amber-900/30 rounded transition-colors ml-auto"
            >
              역할 변경
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
          {isCurrentUser && (
            <span className="text-xs text-neutral-600">
              변경 불가
            </span>
          )}
        </td>
      )}
    </tr>
  );
}
