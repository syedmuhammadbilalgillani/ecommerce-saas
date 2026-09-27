'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Eye, Headphones, Zap } from 'lucide-react';
import {
  getPlatformAdmins,
  createPlatformAdmin,
  setPlatformAdminStatus,
  resetPlatformAdminPassword,
  getCurrentAdmin,
  errorMessage,
  type PlatformAdminUser,
  type PlatformAdmin,
} from '@/lib/api';
import {
  Button,
  Input,
  Label,
  Badge,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui';

export default function AdminsManagementPage() {
  const [admins, setAdmins] = useState<PlatformAdminUser[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Admin form
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [platformRole, setPlatformRole] = useState<'super_admin' | 'support' | 'viewer'>('super_admin');
  const [adding, setAdding] = useState(false);

  // Status updating & Password reset modal
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [resettingAdmin, setResettingAdmin] = useState<PlatformAdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPlatformAdmins(), getCurrentAdmin()])
      .then(([list, me]) => {
        setAdmins(list);
        setCurrentAdmin(me);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setAdding(true);
    setError(null);
    try {
      const updated = await createPlatformAdmin({
        email: email.trim(),
        name: name.trim() || undefined,
        password,
        platformRole,
      });
      setAdmins(updated);
      setShowAdd(false);
      setEmail('');
      setName('');
      setPassword('');
      setPlatformRole('super_admin');
    } catch (err) {
      setError(`Could not add platform admin: ${errorMessage(err)}`);
    } finally {
      setAdding(false);
    }
  };

  const handleToggleStatus = async (admin: PlatformAdminUser) => {
    setUpdatingId(admin.id);
    setError(null);
    try {
      const updated = await setPlatformAdminStatus(admin.id, admin.status === 'active' ? 'disabled' : 'active');
      setAdmins(updated);
    } catch (err) {
      setError(`Could not update admin status: ${errorMessage(err)}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingAdmin || !newPassword) return;
    setResetting(true);
    setError(null);
    try {
      await resetPlatformAdminPassword(resettingAdmin.id, newPassword);
      setResetDone(`Password updated for ${resettingAdmin.email}. Active sessions were revoked.`);
      setNewPassword('');
    } catch (err) {
      setError(`Failed to reset password: ${errorMessage(err)}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl font-normal tracking-tight text-zinc-100">Platform Administrators</h1>
          <p className="text-xs text-zinc-500 font-normal">
            Manage super admin team access, security policies, and credential controls for POSflow Cloud.
          </p>
        </div>
        <Button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs font-normal h-8"
        >
          {showAdd ? (
            'Cancel'
          ) : (
            <span className="inline-flex items-center">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Platform Admin
            </span>
          )}
        </Button>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {showAdd && (
        <Card className="bg-zinc-900/40 border-zinc-800 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-zinc-100">Provision Platform Admin</h2>
            <p className="text-xs text-zinc-500">
              The new administrator will have super admin privileges across all tenants and settings.
            </p>
          </div>
          <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="admin-email">Email Address</Label>
              <Input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@brand.pk"
                className="bg-zinc-950 border-zinc-800 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin-name">Full Name (optional)</Label>
              <Input
                id="admin-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ahmed Khan"
                className="bg-zinc-950 border-zinc-800 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin-role">Platform Role</Label>
              <select
                id="admin-role"
                value={platformRole}
                onChange={(e) => setPlatformRole(e.target.value as any)}
                className="w-full text-xs bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              >
                <option value="super_admin">Super Admin (Full)</option>
                <option value="support">Support (Staff/Impersonate)</option>
                <option value="viewer">Viewer (Read-only)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin-password">Initial Password (min 10)</Label>
              <Input
                id="admin-password"
                type="password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="bg-zinc-950 border-zinc-800 text-xs"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(false)} className="text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={adding} className="text-xs h-8">
                {adding ? 'Creating…' : 'Create Administrator'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/20 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-zinc-800/80 hover:bg-transparent">
              <TableHead className="text-xs text-zinc-400">Admin</TableHead>
              <TableHead className="text-xs text-zinc-400">Role</TableHead>
              <TableHead className="text-xs text-zinc-400">Status</TableHead>
              <TableHead className="text-xs text-zinc-400">Created</TableHead>
              <TableHead className="text-xs text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-xs text-zinc-500">
                  Loading platform administrators…
                </TableCell>
              </TableRow>
            ) : admins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-xs text-zinc-500">
                  No administrators found.
                </TableCell>
              </TableRow>
            ) : (
              admins.map((adm) => {
                const isMe = currentAdmin?.id === adm.id;
                return (
                  <TableRow key={adm.id} className="border-b border-zinc-800/40 hover:bg-zinc-900/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-medium text-xs shrink-0">
                          {(adm.name || adm.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                            {adm.name || adm.email}
                            {isMe && (
                              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded font-normal">
                                You
                              </span>
                            )}
                          </div>
                          {adm.name && <div className="text-[10px] text-zinc-500 font-mono">{adm.email}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {adm.platformRole === 'viewer' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-700/60">
                          <Eye className="w-3 h-3" /> Viewer
                        </span>
                      ) : adm.platformRole === 'support' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                          <Headphones className="w-3 h-3" /> Support Agent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          <Zap className="w-3 h-3" /> Super Admin
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {adm.status === 'active' ? (
                        <Badge variant="success" className="text-[10px]">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">
                          Disabled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500 font-mono">
                      {adm.createdAt.split('T')[0]}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isMe || updatingId === adm.id}
                          onClick={() => handleToggleStatus(adm)}
                          className="h-7 text-[11px] px-2 text-zinc-400 border-zinc-700 disabled:opacity-40"
                          title={isMe ? 'You cannot disable your own account' : undefined}
                        >
                          {adm.status === 'active' ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setResettingAdmin(adm);
                            setResetDone(null);
                            setNewPassword('');
                          }}
                          className="h-7 text-[11px] px-2 text-zinc-400 border-zinc-700"
                        >
                          Reset password
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {resettingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-5">
            <div>
              <h2 className="text-sm font-medium text-zinc-100">Reset Administrator Password</h2>
              <p className="text-xs text-zinc-500">
                Account: <span className="font-mono text-zinc-300">{resettingAdmin.email}</span>
              </p>
            </div>

            {resetDone ? (
              <div className="space-y-4">
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                  {resetDone}
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setResettingAdmin(null)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-new-pw">New Password (min 10 characters)</Label>
                  <Input
                    id="admin-new-pw"
                    type="password"
                    required
                    minLength={10}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-xs"
                    placeholder="••••••••••••"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Setting a new password will instantly terminate all active sessions for this admin.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setResettingAdmin(null)}
                    className="text-xs h-8"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={resetting} className="text-xs h-8">
                    {resetting ? 'Resetting…' : 'Set New Password'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
