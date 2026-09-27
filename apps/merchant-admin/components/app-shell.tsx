'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ExternalLink, LayoutDashboard, Package, FolderTree, ClipboardList, Users, Tag, BarChart3, Settings, Sparkles } from 'lucide-react';
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
            className="inline-flex items-center text-xs font-medium underline hover:text-amber-300 cursor-pointer"
          >
            <span>Exit Impersonation</span>
            <ExternalLink className="w-3 h-3 ml-1" />
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
              <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/products"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <Package className="w-4 h-4 text-muted-foreground" />
              <span>Products & Catalog</span>
            </Link>
            <Link
              href="/collections"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <FolderTree className="w-4 h-4 text-muted-foreground" />
              <span>Collections</span>
            </Link>
            <Link
              href="/orders"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <ClipboardList className="w-4 h-4 text-muted-foreground" />
              <span>Orders & Dispatch</span>
            </Link>
            <Link
              href="/customers"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <Users className="w-4 h-4 text-muted-foreground" />
              <span>Customers CRM</span>
            </Link>
            <Link
              href="/discounts"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <Tag className="w-4 h-4 text-muted-foreground" />
              <span>Discounts</span>
            </Link>
            <Link
              href="/analytics"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <span>Analytics & Reports</span>
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span>Settings</span>
            </Link>

            <div className="pt-2 pb-1 px-2 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
              Storefront & AI
            </div>

            <Link
              href="/storefront-ai"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors group"
            >
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
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
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
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
