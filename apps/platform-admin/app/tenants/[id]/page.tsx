'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Plus } from 'lucide-react';
import {
  getTenant,
  updateTenant,
  setTenantStatus,
  addTenantStore,
  getTenantUsers,
  createTenantUser,
  setTenantUserStatus,
  impersonateTenant,
  formatPrice,
  errorMessage,
  type TenantDetail,
  type TenantStoreDetail,
  type TenantUser,
} from '@/lib/api';
import {
  Card,
  Button,
  Input,
  Label,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui';
import { ResetPasswordDialog } from '@/components/reset-password-dialog';
import { CloudinaryCard } from '@/components/cloudinary-card';

const MERCHANT_ADMIN_URL = process.env.NEXT_PUBLIC_MERCHANT_ADMIN_URL || 'http://localhost:3001';
const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function TenantDetailPage() {
  const params = useParams();
  const tenantId = params?.id as string;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Tenant/store edit form
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState('starter');
  const [planPrice, setPlanPrice] = useState('5000');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSaved, setDetailsSaved] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Add store form
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreSlug, setNewStoreSlug] = useState('');
  const [newStoreWhatsapp, setNewStoreWhatsapp] = useState('');
  const [addingStore, setAddingStore] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [showAddStore, setShowAddStore] = useState(false);

  // Add staff form
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [addingStaff, setAddingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [showAddStaff, setShowAddStaff] = useState(false);

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [resettingUser, setResettingUser] = useState<TenantUser | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([getTenant(tenantId), getTenantUsers(tenantId)])
      .then(([t, u]) => {
        setTenant(t);
        setName(t.name);
        setStoreName(t.storeName ?? '');
        setSlug(t.slug ?? '');
        setPlan(t.plan || 'starter');
        setPlanPrice(t.planPriceMinor ? String(t.planPriceMinor / 100) : '5000');
        setUsers(u);
      })
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDetails(true);
    setDetailsError(null);
    setDetailsSaved(null);
    try {
      const updated = await updateTenant(tenantId, {
        name: name.trim(),
        storeName: tenant?.storeId ? storeName.trim() : undefined,
        slug: tenant?.storeId ? slugify(slug) : undefined,
        plan,
        planPriceMinor: Math.round(Number(planPrice) * 100),
      });
      setTenant(updated);
      setName(updated.name);
      setStoreName(updated.storeName ?? '');
      setSlug(updated.slug ?? '');
      setPlan(updated.plan || 'starter');
      setPlanPrice(updated.planPriceMinor ? String(updated.planPriceMinor / 100) : '5000');
      setDetailsSaved('Saved.');
    } catch (err) {
      setDetailsError(errorMessage(err));
    } finally {
      setSavingDetails(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!tenant) return;
    setTogglingStatus(true);
    setDetailsError(null);
    try {
      const updated = await setTenantStatus(tenant.id, tenant.status === 'active' ? 'suspended' : 'active');
      setTenant((prev) => (prev ? { ...prev, status: updated.status } : prev));
    } catch (err) {
      setDetailsError(errorMessage(err));
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingStore(true);
    setStoreError(null);
    try {
      const updated = await addTenantStore(tenantId, {
        name: newStoreName.trim(),
        slug: slugify(newStoreSlug),
        whatsappPhone: newStoreWhatsapp.trim() || undefined,
      });
      setTenant(updated);
      setNewStoreName('');
      setNewStoreSlug('');
      setNewStoreWhatsapp('');
      setShowAddStore(false);
    } catch (err) {
      setStoreError(errorMessage(err));
    } finally {
      setAddingStore(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingStaff(true);
    setStaffError(null);
    try {
      const updatedUsers = await createTenantUser(tenantId, {
        email: staffEmail.trim(),
        password: staffPassword,
        name: staffName.trim() || undefined,
      });
      setUsers(updatedUsers);
      setStaffEmail('');
      setStaffName('');
      setStaffPassword('');
      setShowAddStaff(false);
    } catch (err) {
      setStaffError(errorMessage(err));
    } finally {
      setAddingStaff(false);
    }
  };

  const handleToggleUserStatus = async (user: TenantUser) => {
    setUpdatingUserId(user.id);
    setStaffError(null);
    try {
      const updatedUsers = await setTenantUserStatus(tenantId, user.id, user.status === 'active' ? 'disabled' : 'active');
      setUsers(updatedUsers);
    } catch (err) {
      setStaffError(`Could not update ${user.email}: ${errorMessage(err)}`);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleImpersonate = async (userId?: string) => {
    setImpersonating(userId ?? 'owner');
    try {
      const res = await impersonateTenant(tenantId, userId);
      window.open(res.redirectUrl, '_blank');
    } catch (err) {
      alert(`Could not open merchant portal: ${errorMessage(err)}`);
    } finally {
      setImpersonating(null);
    }
  };

  if (loading) {
    return <p className="text-xs text-zinc-500">Loading tenant…</p>;
  }

  if (loadError || !tenant) {
    return (
      <div className="space-y-3">
        <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {loadError ?? 'Tenant not found.'}
        </div>
        <Link href="/tenants" className="inline-flex items-center text-xs text-zinc-400 hover:text-zinc-200 underline">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          <span>Back to tenants</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <Link href="/tenants" className="inline-flex items-center text-[11px] text-zinc-500 hover:text-zinc-300">
            <ArrowLeft className="w-3 h-3 mr-1" />
            <span>Tenants</span>
          </Link>
          <h1 className="text-xl font-normal tracking-tight text-zinc-100 mt-1">{tenant.name}</h1>
          <p className="text-xs text-zinc-500 font-normal">
            Created {tenant.createdAt} · {formatPrice(tenant.monthlyGmvMinor)} GMV · Plan: <span className="uppercase text-zinc-400 font-medium">{tenant.plan || 'starter'}</span> ({formatPrice(tenant.planPriceMinor ?? 500000)}/{tenant.planInterval || 'mo'})
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tenant.status === 'active' ? (
            <Badge variant="success" className="text-[10px]">Active</Badge>
          ) : (
            <Badge variant="destructive" className="text-[10px]">Suspended</Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={togglingStatus}
            onClick={handleToggleStatus}
            className="h-8 text-xs text-zinc-400 border-zinc-700"
          >
            {togglingStatus ? 'Updating...' : tenant.status === 'active' ? 'Suspend tenant' : 'Activate tenant'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs text-zinc-300 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
            onClick={() => handleImpersonate()}
            disabled={impersonating !== null || tenant.status === 'suspended'}
            title={tenant.status === 'suspended' ? 'Tenant is suspended' : 'Login directly into merchant portal'}
          >
            {impersonating === 'owner' ? (
              'Opening Portal…'
            ) : (
              <span className="inline-flex items-center">
                Open Portal
                <ExternalLink className="w-3 h-3 ml-1" />
              </span>
            )}
          </Button>
        </div>
      </div>

      <Card className="bg-zinc-900/30 border-zinc-800/80 p-5 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">Tenant &amp; store details</h2>
          <p className="text-xs text-zinc-500">Renaming the store does not change its storefront URL slug unless you also edit it.</p>
        </div>

        {detailsError && (
          <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {detailsError}
          </div>
        )}
        {detailsSaved && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
            {detailsSaved}
          </div>
        )}

        <form onSubmit={handleSaveDetails} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tenantName">Tenant / brand name</Label>
              <Input id="tenantName" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tenantPlan">Subscription Plan Tier</Label>
              <select
                id="tenantPlan"
                value={plan}
                onChange={(e) => {
                  const newPlan = e.target.value;
                  setPlan(newPlan);
                  if (newPlan === 'starter') setPlanPrice('5000');
                  if (newPlan === 'growth') setPlanPrice('15000');
                  if (newPlan === 'enterprise') setPlanPrice('50000');
                }}
                className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              >
                <option value="starter">Starter — PKR 5,000 / mo</option>
                <option value="growth">Growth — PKR 15,000 / mo</option>
                <option value="enterprise">Enterprise — PKR 50,000 / mo</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tenantPlanPrice">Monthly Price (PKR)</Label>
              <Input
                id="tenantPlanPrice"
                type="number"
                value={planPrice}
                onChange={(e) => setPlanPrice(e.target.value)}
                required
              />
            </div>

            {tenant.storeId ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="storeName">Primary Store name</Label>
                  <Input id="storeName" value={storeName} onChange={(e) => setStoreName(e.target.value)} required />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="storeSlug">Storefront URL slug</Label>
                  <Input id="storeSlug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
                  <p className="text-[11px] text-zinc-500">
                    Changing this changes the store&apos;s public URL. Existing links using the old slug will 404.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-zinc-500 md:col-span-2">This tenant has no store yet.</p>
            )}
          </div>
          <Button type="submit" disabled={savingDetails} className="text-xs font-normal h-8">
            {savingDetails ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </Card>

      <Card className="bg-zinc-900/30 border-zinc-800/80 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-zinc-100">Stores Fleet</h2>
            <p className="text-xs text-zinc-500">All retail storefronts belonging to this tenant brand.</p>
          </div>
          <Button size="sm" onClick={() => setShowAddStore((v) => !v)} className="text-xs font-normal h-8">
            {showAddStore ? (
              'Cancel'
            ) : (
              <span className="inline-flex items-center">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add store
              </span>
            )}
          </Button>
        </div>

        {storeError && (
          <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {storeError}
          </div>
        )}

        {showAddStore && (
          <form onSubmit={handleAddStore} className="space-y-3 border-t border-zinc-800/70 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="newStoreName">Store name</Label>
                <Input
                  id="newStoreName"
                  placeholder="e.g. Lahore Flagship"
                  value={newStoreName}
                  onChange={(e) => {
                    setNewStoreName(e.target.value);
                    if (!newStoreSlug) setNewStoreSlug(slugify(e.target.value));
                  }}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newStoreSlug">URL slug</Label>
                <Input
                  id="newStoreSlug"
                  placeholder="e.g. lahore-flagship"
                  value={newStoreSlug}
                  onChange={(e) => setNewStoreSlug(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newStoreWhatsapp">WhatsApp Phone (optional)</Label>
                <Input
                  id="newStoreWhatsapp"
                  placeholder="e.g. +923001234567"
                  value={newStoreWhatsapp}
                  onChange={(e) => setNewStoreWhatsapp(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={addingStore} className="text-xs font-normal">
              {addingStore ? 'Creating store...' : 'Create store'}
            </Button>
          </form>
        )}

        <div className="rounded-lg border border-zinc-800/80 overflow-hidden">
          <Table>
            <TableHeader className="bg-zinc-900/50">
              <TableRow>
                <TableHead>Store Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead className="text-right">Storefront</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!tenant.stores || tenant.stores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-zinc-500 text-xs">
                    No stores provisioned yet.
                  </TableCell>
                </TableRow>
              ) : (
                tenant.stores.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="text-xs font-medium text-zinc-200">{s.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{s.id}</div>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400 font-mono">{s.slug}</TableCell>
                    <TableCell className="text-xs text-zinc-400">{s.currency}</TableCell>
                    <TableCell className="text-xs text-zinc-400 font-mono">{s.whatsappPhone || '—'}</TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`${STOREFRONT_URL}?store=${s.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-100 underline"
                      >
                        <span>Visit Storefront</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="bg-zinc-900/30 border-zinc-800/80 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-zinc-100">Staff logins</h2>
            <p className="text-xs text-zinc-500">Merchant admin accounts for this tenant.</p>
          </div>
          <Button size="sm" onClick={() => setShowAddStaff((v) => !v)} className="text-xs font-normal h-8">
            {showAddStaff ? (
              'Cancel'
            ) : (
              <span className="inline-flex items-center">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add staff login
              </span>
            )}
          </Button>
        </div>

        {staffError && (
          <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {staffError}
          </div>
        )}

        {showAddStaff && (
          <form onSubmit={handleAddStaff} className="space-y-3 border-t border-zinc-800/70 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="staffEmail">Email</Label>
                <Input
                  id="staffEmail"
                  type="email"
                  placeholder="staff@brand.pk"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staffName">Name (optional)</Label>
                <Input id="staffName" value={staffName} onChange={(e) => setStaffName(e.target.value)} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="staffPassword">Initial password (min 10 characters)</Label>
                <Input
                  id="staffPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={addingStaff} className="text-xs font-normal">
              {addingStaff ? 'Adding...' : 'Add staff login'}
            </Button>
          </form>
        )}

        <div className="rounded-lg border border-zinc-800/80 overflow-hidden">
          <Table>
            <TableHeader className="bg-zinc-900/50">
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-zinc-500 text-xs">
                    No staff logins yet.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="text-xs text-zinc-200">{u.name || u.email}</div>
                      {u.name && <div className="text-[10px] text-zinc-500 font-mono">{u.email}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400 capitalize">{u.role}</TableCell>
                    <TableCell>
                      {u.status === 'active' ? (
                        <Badge variant="success" className="text-[10px]">Active</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500 font-mono">{u.createdAt.split('T')[0]}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleImpersonate(u.id)}
                          disabled={impersonating !== null || u.status === 'disabled' || tenant.status === 'suspended'}
                          className="h-7 text-[11px] px-2 text-zinc-400 hover:text-zinc-200"
                          title="Login directly as this staff user"
                        >
                          {impersonating === u.id ? (
                            'Opening…'
                          ) : (
                            <span className="inline-flex items-center">
                              Impersonate
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </span>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingUserId === u.id}
                          onClick={() => handleToggleUserStatus(u)}
                          className="h-7 text-[11px] px-2 text-zinc-400 border-zinc-700"
                        >
                          {u.status === 'active' ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setResettingUser(u)}
                          className="h-7 text-[11px] px-2 text-zinc-400 border-zinc-700"
                        >
                          Reset password
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <CloudinaryCard tenantId={tenant.id} />

      {resettingUser && (
        <ResetPasswordDialog
          tenantId={tenant.id}
          tenantName={tenant.name}
          onlyUser={resettingUser}
          onClose={() => setResettingUser(null)}
        />
      )}
    </div>
  );
}
