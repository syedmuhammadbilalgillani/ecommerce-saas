'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  errorMessage,
  getTenantCloudinary,
  removeTenantCloudinary,
  setTenantCloudinary,
  type TenantCloudinary,
} from '@/lib/api';
import { Badge, Button, Card, Input, Label } from '@repo/ui';

export function CloudinaryCard({ tenantId }: { tenantId: string }) {
  const [config, setConfig] = useState<TenantCloudinary | null>(null);
  const [cloudName, setCloudName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const cfg = await getTenantCloudinary(tenantId);
      setConfig(cfg);
      if (cfg.configured) {
        setCloudName(cfg.cloudName);
        setApiKey(cfg.apiKey);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const cfg = await setTenantCloudinary(tenantId, {
        cloudName: cloudName.trim(),
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
      });
      setConfig(cfg);
      setApiSecret('');
      setNotice('Credentials verified with Cloudinary and saved.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove Cloudinary credentials? This merchant will lose image uploads (existing images keep working).')) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await removeTenantCloudinary(tenantId);
      setConfig({ configured: false });
      setCloudName('');
      setApiKey('');
      setApiSecret('');
      setNotice('Cloudinary credentials removed.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-zinc-900/30 border-zinc-800/80 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800/60 pb-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">Image uploads (Cloudinary)</h2>
          <p className="text-xs text-zinc-500">
            This tenant&apos;s own Cloudinary account. The API secret is stored encrypted and is never shown again.
          </p>
        </div>
        {config && (
          <Badge variant="secondary" className="text-[10px]">
            {config.configured ? 'Enabled' : 'Not configured'}
          </Badge>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">{notice}</div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="cld-name">Cloud name</Label>
          <Input id="cld-name" value={cloudName} onChange={(e) => setCloudName(e.target.value)} placeholder="my-cloud" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cld-key">API key</Label>
          <Input id="cld-key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="123456789012345" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cld-secret">API secret</Label>
          <Input
            id="cld-secret"
            type="password"
            autoComplete="off"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            placeholder={config?.configured ? 'Enter again to change' : 'Cloudinary API secret'}
            required
          />
        </div>
        <div className="md:col-span-3 flex items-center gap-2">
          <Button type="submit" disabled={busy} className="h-8 text-xs font-normal">
            {busy ? 'Verifying...' : config?.configured ? 'Update credentials' : 'Save credentials'}
          </Button>
          {config?.configured && (
            <Button type="button" variant="outline" disabled={busy} onClick={handleRemove} className="h-8 text-xs font-normal">
              Remove
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
