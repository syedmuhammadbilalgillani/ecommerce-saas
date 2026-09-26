'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { getCurrentMerchant, logout, type CurrentMerchant } from '@/lib/api';

const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000';
const PLATFORM_ADMIN_URL = process.env.NEXT_PUBLIC_PLATFORM_ADMIN_URL || 'http://localhost:3002';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<CurrentMerchant | null>(null);
  const [activeStoreId, setActiveStoreId] = useState<string>('');
  const [impersonatedBy, setImpersonatedBy] = useState<string | null>(null);
  const isAuthPage = pathname === '/login' || pathname === '/impersonate';

  useEffect(() => {
    if (isAuthPage) return;
    getCurrentMerchant()
      .then((m) => {
        setMe(m);
        const cookieStore = getCookie('posflow_active_store');
        const localStore = typeof window !== 'undefined' ? localStorage.getItem('posflow_active_store_id') : null;
        setActiveStoreId(cookieStore || localStore || m?.storeId || '');
      })
      .catch(() => setMe(null));
    setImpersonatedBy(getCookie('posflow_impersonated_by'));
  }, [isAuthPage, pathname]);

  if (isAuthPage) {
    return <main className="flex-1 flex items-center justify-center bg-background p-6">{children}</main>;
  }

  const handleLogout = async () => {
    await logout().catch(() => null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('posflow_active_store_id');
      document.cookie = 'posflow_active_store=; path=/; max-age=0;';
    }
    router.replace('/login');
    router.refresh();
  };

  const handleSwitchStore = (storeId: string) => {
    setActiveStoreId(storeId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('posflow_active_store_id', storeId);
    }
    document.cookie = `posflow_active_store=${encodeURIComponent(storeId)}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  };

  const handleExitImpersonation = async () => {
    await logout().catch(() => null);
    document.cookie = 'posflow_impersonated_by=; Path=/; Max-Age=0;';
    window.location.href = `${PLATFORM_ADMIN_URL}/tenants`;
  };

  return (
    <div className="flex flex-col w-full min-h-screen">
      {impersonatedBy && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/25 px-4 py-1.5 flex items-center justify-between text-xs text-amber-500 z-30 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="font-semibold bg-amber-500/20 px-1.5 py-0.5 rounded text-[10px] tracking-wider uppercase">
              Support Mode
            </span>
            <span>
              You are viewing this store as Platform Admin <strong className="font-medium text-amber-400">{impersonatedBy}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={handleExitImpersonation}
            className="text-xs font-medium underline hover:text-amber-300 cursor-pointer"
          >
            Exit Impersonation ↗
          </button>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        {/* Calm, Minimalist Merchant Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col justify-between py-4 px-3 select-none">
        <div className="space-y-5">
          {/* Store Branding + Theme Toggle */}
          <div className="px-2 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 shrink-0 rounded bg-primary text-primary-foreground flex items-center justify-center font-medium text-xs">
                P
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium tracking-tight text-foreground truncate">Merchant Portal</div>
                <div className="text-[10px] text-muted-foreground font-normal truncate">{me?.storeName ?? '…'}</div>
              </div>
            </div>
            <ThemeToggle />
          </div>

          {/* Store Switcher for Multi-store Tenants */}
          {me?.stores && me.stores.length > 1 && (
            <div className="px-2 pt-0.5">
              <label htmlFor="store-select" className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">
                Active Store
              </label>
              <select
                id="store-select"
                value={activeStoreId}
                onChange={(e) => handleSwitchStore(e.target.value)}
                className="w-full text-xs bg-muted/70 border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              >
                {me.stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.slug})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Navigation links */}
          <nav className="space-y-0.5">
            <div className="px-2 pb-1.5 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
              Store Operations
            </div>
            <Link
              href="/"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Dashboard</span>
            </Link>
            <Link
              href="/products"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span>Products & Catalog</span>
            </Link>
            <Link
              href="/collections"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Collections</span>
            </Link>
            <Link
              href="/orders"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>Orders & Dispatch</span>
            </Link>
            <Link
              href="/customers"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Customers CRM</span>
            </Link>
            <Link
              href="/discounts"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span>Discounts</span>
            </Link>
            <Link
              href="/analytics"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Analytics & Reports</span>
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Settings</span>
            </Link>

            <div className="pt-2 pb-1 px-2 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
              Storefront & AI
            </div>

            <Link
              href="/storefront-ai"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors group"
            >
              <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div className="flex items-center justify-between w-full min-w-0">
                <span className="truncate">AI Storefront Studio</span>
                <span className="text-[9px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded border border-amber-500/20">
                  AI
                </span>
              </div>
            </Link>
          </nav>
        </div>

        {/* Footer: storefront link + signed-in user */}
        <div className="px-2 pt-4 border-t border-border space-y-2">
          <a
            href={STOREFRONT_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-2 rounded bg-muted/50 border border-border text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <span>View Live Storefront</span>
            <span className="text-muted-foreground">↗</span>
          </a>
          <div className="flex items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground">
            <span className="truncate" title={me?.email}>{me?.email ?? ''}</span>
            <button type="button" onClick={handleLogout} className="shrink-0 underline hover:text-foreground">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-background p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
