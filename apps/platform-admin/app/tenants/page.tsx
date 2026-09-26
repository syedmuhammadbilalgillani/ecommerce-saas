'use client';

import React, { useState, useEffect } from 'react';
import { getPlatformTenants, createTenant, setTenantStatus, formatPrice, errorMessage, type PlatformTenant } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MERCHANT_ADMIN_URL = process.env.NEXT_PUBLIC_MERCHANT_ADMIN_URL || 'http://localhost:3001';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function TenantsManagementPage() {
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProvisioning, setIsProvisioning] = useState(false);

  // Form State
  const [tenantName, setTenantName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setTenants(await getPlatformTenants());
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const created = await createTenant({
        name: tenantName.trim(),
        slug: slugify(slug || tenantName),
        ownerEmail: ownerEmail.trim(),
        ownerPassword,
      });
      setTenants(prev => [created, ...prev]);
      setIsProvisioning(false);
      setTenantName('');
      setSlug('');
      setSlugEdited(false);
      setOwnerEmail('');
      setOwnerPassword('');
    } catch (err) {
      setError(`Could not create tenant: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleTenantStatus = async (tenant: PlatformTenant) => {
    setUpdatingId(tenant.id);
    setError(null);
    try {
      const updated = await setTenantStatus(tenant.id, tenant.status === 'active' ? 'suspended' : 'active');
      setTenants(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(`Could not update tenant status: ${errorMessage(err)}`);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl font-normal tracking-tight text-zinc-100">Tenants & Store Fleet</h1>
          <p className="text-xs text-zinc-500 font-normal">
            Onboard new retail brands, manage subscription tiers, and control store operational status.
          </p>
        </div>
        <Button
          onClick={() => setIsProvisioning(!isProvisioning)}
          className="text-xs font-normal h-8"
        >
          {isProvisioning ? 'Cancel' : '+ Provision New Tenant'}
        </Button>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Provisioning Drawer */}
      {isProvisioning && (
        <Card className="bg-zinc-900/30 border-zinc-800/80 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-zinc-100">Provision New Merchant Tenant</h2>
            <p className="text-xs text-zinc-500">Allocates database partition, unique tenant ID, and sets up default store.</p>
          </div>

          <form onSubmit={handleCreateTenant} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="tName">Brand / Tenant Name</Label>
                <Input
                  id="tName"
                  placeholder="e.g. Alkaram Studio"
                  value={tenantName}
                  onChange={(e) => {
                    setTenantName(e.target.value);
                    if (!slugEdited) setSlug(slugify(e.target.value));
                  }}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tSlug">Identifier (Subdomain Slug)</Label>
                <Input
                  id="tSlug"
                  placeholder="alkaram"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugEdited(e.target.value !== '');
                  }}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tOwnerEmail">Owner Email (merchant login)</Label>
                <Input
                  id="tOwnerEmail"
                  type="email"
                  placeholder="owner@brand.pk"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tOwnerPassword">Owner Initial Password</Label>
                <Input
                  id="tOwnerPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  required
                />
              </div>

            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/70">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsProvisioning(false)}
                className="text-xs font-normal"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="text-xs font-normal">
                {saving ? 'Provisioning...' : 'Provision Tenant'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tenants Table */}
      <div className="rounded-lg border border-zinc-800/80 overflow-hidden bg-zinc-900/20">
        <Table>
          <TableHeader className="bg-zinc-900/50">
            <TableRow>
              <TableHead>Tenant Brand</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Stores</TableHead>
              <TableHead>Monthly GMV</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-zinc-500 text-xs">
                  Loading tenants directory...
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="text-xs font-normal text-zinc-200">{t.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">slug: {t.slug ?? '—'}</div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                      {t.plan ?? 'no plan'}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs text-zinc-400">
                    {t.storesCount} active
                  </TableCell>

                  <TableCell className="text-xs font-mono text-zinc-300">
                    {formatPrice(t.monthlyGmvMinor)}
                  </TableCell>

                  <TableCell className="text-xs text-zinc-500 font-mono">
                    {t.createdAt}
                  </TableCell>

                  <TableCell>
                    {t.status === 'active' ? (
                      <Badge variant="success" className="text-[10px]">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">
                        Suspended
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleTenantStatus(t)}
                        disabled={updatingId === t.id}
                        className="h-7 text-[11px] px-2 text-zinc-400 border-zinc-700"
                      >
                        {t.status === 'active' ? 'Suspend' : 'Activate'}
                      </Button>
                      <a
                        href={MERCHANT_ADMIN_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center h-7 text-[11px] text-zinc-300 hover:text-zinc-100 px-2 rounded bg-zinc-800 border border-zinc-700 transition-colors"
                      >
                        Portal ↗
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
