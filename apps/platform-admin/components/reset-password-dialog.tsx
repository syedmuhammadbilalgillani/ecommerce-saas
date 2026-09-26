'use client';

import React, { useEffect, useState } from 'react';
import { errorMessage, getTenantUsers, resetMerchantPassword, type TenantUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ResetPasswordDialogProps {
  tenantId: string;
  tenantName: string;
  /** Preselect one user and skip fetching the tenant's user list (used from the tenant detail page). */
  onlyUser?: TenantUser;
  onClose: () => void;
}

/** Lets a platform admin set a new password for one of a tenant's merchant users. */
export function ResetPasswordDialog({ tenantId, tenantName, onlyUser, onClose }: ResetPasswordDialogProps) {
  const [users, setUsers] = useState<TenantUser[] | null>(onlyUser ? [onlyUser] : null);
  const [userId, setUserId] = useState(onlyUser?.id ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (onlyUser) return;
    getTenantUsers(tenantId)
      .then((list) => {
        const merchants = list.filter((u) => u.role === 'merchant');
        setUsers(merchants);
        setUserId(merchants[0]?.id ?? '');
      })
      .catch((err) => setError(errorMessage(err)));
  }, [tenantId, onlyUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setDone(null);
    try {
      await resetMerchantPassword(userId, password);
      const email = users?.find((u) => u.id === userId)?.email;
      setPassword('');
      setDone(`Password reset for ${email}. They were signed out everywhere — share the new password with them securely.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">Reset merchant password</h2>
          <p className="text-xs text-zinc-500">{tenantName}</p>
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}
        {done && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">{done}</div>
        )}

        {users === null && !error && <p className="text-xs text-zinc-500">Loading users…</p>}
        {users?.length === 0 && <p className="text-xs text-zinc-500">This tenant has no merchant users.</p>}

        {users && users.length > 0 && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rp-user">User</Label>
              <select
                id="rp-user"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-200"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-password">New password (min 10 characters)</Label>
              <Input
                id="rp-password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
                Close
              </Button>
              <Button type="submit" size="sm" disabled={saving || !userId} className="text-xs">
                {saving ? 'Resetting...' : 'Reset password'}
              </Button>
            </div>
          </form>
        )}

        {(users?.length === 0 || (error && users === null)) && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
