'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, ExternalLink } from 'lucide-react';
import {
  getPlatformTenants,
  createTenant,
  setTenantStatus,
  impersonateTenant,
  formatPrice,
  errorMessage,
  type PlatformTenant,
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
import { ResetPasswordDialog } from '@/components/reset-password-dialog';

const MERCHANT_ADMIN_URL = process.env.NEXT_PUBLIC_MERCHANT_ADMIN_URL || 'http://localhost:3001';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function TenantsManagementPage() {
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  // Form State
  const [tenantName, setTenantName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [plan, setPlan] = useState('starter');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resettingFor, setResettingFor] = useState<PlatformTenant | null>(null);

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
        plan,
      });
      setTenants(prev => [created, ...prev]);
      setIsProvisioning(false);
      setTenantName('');
      setSlug('');
      setSlugEdited(false);
      setPlan('starter');
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

  const handleImpersonate = async (tenantId: string) => {
    setImpersonatingId(tenantId);
    setError(null);
    try {
      const res = await impersonateTenant(tenantId);
      window.open(res.redirectUrl, '_blank');
    } catch (err) {
      setError(`Could not open merchant portal: ${errorMessage(err)}`);
    } finally {
      setImpersonatingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-full">
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
          {isProvisioning ? (
            'Cancel'
          ) : (
            <span className="inline-flex items-center">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Provision New Tenant
            </span>
          )}
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
                <Label htmlFor="tPlan">Subscription Tier</Label>
                <select
                  id="tPlan"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                >
                  <option value="starter">Starter — PKR 5,000 / mo (ARR PKR 60,000)</option>
                  <option value="growth">Growth — PKR 15,000 / mo (ARR PKR 180,000)</option>
                  <option value="enterprise">Enterprise — PKR 50,000 / mo (ARR PKR 600,000)</option>
                </select>
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
                    <Link href={`/tenants/${t.id}`} className="text-xs font-normal text-zinc-200 hover:text-white hover:underline">
                      {t.name}
                    </Link>
                    <div className="text-[10px] text-zinc-500 font-mono">slug: {t.slug ?? '—'}</div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                      {t.plan || 'starter'}
                    </Badge>
                    {t.planPriceMinor ? (
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {formatPrice(t.planPriceMinor)}/{t.planInterval || 'mo'}
                      </div>
                    ) : null}
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
                      <Link
                        href={`/tenants/${t.id}`}
                        className="inline-flex items-center h-7 text-[11px] text-zinc-300 hover:text-zinc-100 px-2 rounded bg-zinc-800 border border-zinc-700 transition-colors"
                      >
                        Manage
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleTenantStatus(t)}
                        disabled={updatingId === t.id}
                        className="h-7 text-[11px] px-2 text-zinc-400 border-zinc-700"
                      >
                        {t.status === 'active' ? 'Suspend' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setResettingFor(t)}
                        className="h-7 text-[11px] px-2 text-zinc-400 border-zinc-700"
                      >
                        Reset password
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleImpersonate(t.id)}
                        disabled={impersonatingId === t.id || t.status === 'suspended'}
                        className="h-7 text-[11px] px-2 text-zinc-300 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                        title={t.status === 'suspended' ? 'Tenant is suspended' : 'Login directly into merchant portal'}
                      >
                        {impersonatingId === t.id ? (
                          'Opening…'
                        ) : (
                          <span className="inline-flex items-center">
                            Portal
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </span>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {resettingFor && (
        <ResetPasswordDialog tenantId={resettingFor.id} tenantName={resettingFor.name} onClose={() => setResettingFor(null)} />
      )}
    </div>
  );
}
