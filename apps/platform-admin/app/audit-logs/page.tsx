'use client';

import React, { useEffect, useState } from 'react';
import { getAuditLogs, errorMessage, type AuditLog } from '@/lib/api';
import { Card, Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@repo/ui';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('');

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAuditLogs({
        limit: 100,
        action: filterAction || undefined,
      });
      setLogs(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [filterAction]);

  const formatAction = (action: string) => {
    switch (action) {
      case 'tenant.created':
        return <Badge variant="success" className="text-[10px] font-mono">tenant.created</Badge>;
      case 'tenant.suspended':
        return <Badge variant="destructive" className="text-[10px] font-mono">tenant.suspended</Badge>;
      case 'tenant.activated':
        return <Badge variant="success" className="text-[10px] font-mono">tenant.activated</Badge>;
      case 'tenant.updated':
        return <Badge variant="secondary" className="text-[10px] font-mono">tenant.updated</Badge>;
      case 'tenant.impersonated':
        return <Badge className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">impersonated</Badge>;
      case 'store.created':
        return <Badge className="text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">store.created</Badge>;
      case 'admin.created':
        return <Badge className="text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">admin.created</Badge>;
      case 'admin.status_changed':
        return <Badge variant="outline" className="text-[10px] font-mono">admin.status_changed</Badge>;
      case 'admin.password_reset':
        return <Badge className="text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">admin.pw_reset</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] font-mono">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl font-normal tracking-tight text-zinc-100">Audit &amp; Security Logs</h1>
          <p className="text-xs text-zinc-500 font-normal">
            Tamper-evident trail of administrative mutations, credential changes, and impersonation events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="text-xs bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none"
          >
            <option value="">All Actions</option>
            <option value="tenant.created">tenant.created</option>
            <option value="tenant.suspended">tenant.suspended</option>
            <option value="tenant.activated">tenant.activated</option>
            <option value="tenant.updated">tenant.updated</option>
            <option value="tenant.impersonated">tenant.impersonated</option>
            <option value="store.created">store.created</option>
            <option value="admin.created">admin.created</option>
            <option value="admin.status_changed">admin.status_changed</option>
            <option value="admin.password_reset">admin.password_reset</option>
          </select>
          <Button size="sm" variant="outline" onClick={loadLogs} className="text-xs font-normal h-8">
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <Card className="bg-zinc-900/30 border-zinc-800/80 overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-900/60">
            <TableRow>
              <TableHead className="w-36">Timestamp</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-zinc-500 text-xs">
                  Loading activity logs...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-zinc-500 text-xs">
                  No audit logs recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} className="border-b border-zinc-800/40 hover:bg-zinc-900/40">
                  <TableCell className="text-xs text-zinc-400 font-mono">
                    <div>{log.createdAt.split('T')[0]}</div>
                    <div className="text-[10px] text-zinc-600">
                      {log.createdAt.split('T')[1]?.slice(0, 8)} UTC
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-zinc-200">{log.actorEmail}</div>
                    <div className="text-[10px] text-zinc-500 font-mono capitalize">
                      {log.actorRole.replace('_', ' ')}
                    </div>
                  </TableCell>
                  <TableCell>{formatAction(log.action)}</TableCell>
                  <TableCell className="text-xs text-zinc-400 font-mono">
                    <span className="text-zinc-500 text-[10px] uppercase block">{log.targetType}</span>
                    <span className="truncate max-w-[120px] inline-block" title={log.targetId}>{log.targetId}</span>
                  </TableCell>
                  <TableCell className="text-xs text-zinc-400 font-mono">
                    {log.metadata ? (
                      <span className="text-[11px] text-zinc-400 bg-zinc-950/60 border border-zinc-800/60 rounded px-2 py-1 inline-block max-w-sm truncate" title={JSON.stringify(log.metadata, null, 2)}>
                        {JSON.stringify(log.metadata)}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
