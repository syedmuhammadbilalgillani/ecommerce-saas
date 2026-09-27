'use client';

import React, { useState } from 'react';
import { changePassword, errorMessage } from '@/lib/api';
import { Card } from '@repo/ui/card';
import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { Label } from '@repo/ui/label';

export default function AccountPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setDone('Password changed. Other devices have been signed out.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md">
      <div className="border-b border-zinc-800/80 pb-4">
        <h1 className="text-xl font-normal tracking-tight text-zinc-100">Account</h1>
        <p className="text-xs text-zinc-500">
          Change your platform admin password. Forgot it? Run <span className="font-mono">pnpm db:reset-password --email …</span> on
          the server.
        </p>
      </div>

      <Card className="bg-zinc-900/30 border-zinc-800/80 p-5 space-y-4">
        {error && (
          <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}
        {done && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">{done}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current">Current password</Label>
            <Input
              id="current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new">New password (min 10 characters)</Label>
            <Input
              id="new"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={saving} className="text-xs font-normal h-8">
            {saving ? 'Changing...' : 'Change password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
