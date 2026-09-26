'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { getCurrentAdmin, logout, type PlatformAdmin } from '@/lib/api';

const MERCHANT_ADMIN_URL = process.env.NEXT_PUBLIC_MERCHANT_ADMIN_URL || 'http://localhost:3001';
const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<PlatformAdmin | null>(null);
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (isLoginPage) return;
    getCurrentAdmin().then(setMe).catch(() => setMe(null));
  }, [isLoginPage]);

  if (isLoginPage) {
    return <main className="flex-1 flex items-center justify-center bg-background p-6">{children}</main>;
  }

  const handleLogout = async () => {
    await logout().catch(() => null);
    router.replace('/login');
    router.refresh();
  };

  return (
    <>
      {/* Calm, Minimalist Platform Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col justify-between py-4 px-3 select-none">
        <div className="space-y-5">
          {/* SaaS Platform Brand + Theme Toggle */}
          <div className="px-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center font-medium text-xs">
                ⚡
              </div>
              <div>
                <div className="text-xs font-medium tracking-tight text-foreground">POSflow Cloud</div>
                <div className="text-[10px] text-muted-foreground font-normal">Super Admin Control</div>
              </div>
            </div>
            <ThemeToggle />
          </div>

          {/* Navigation links */}
          <nav className="space-y-0.5">
            <div className="px-2 pb-1.5 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
              SaaS Operations
            </div>
            <Link
              href="/"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Platform Metrics</span>
            </Link>
            <Link
              href="/tenants"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>Tenants & Stores</span>
            </Link>
            <Link
              href="/account"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Account</span>
            </Link>
          </nav>

          <nav className="space-y-0.5">
            <div className="px-2 pb-1.5 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
              Connected Portals
            </div>
            <a
              href={MERCHANT_ADMIN_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md transition-colors"
            >
              <span>Merchant Admin</span>
              <span className="text-[10px] text-muted-foreground font-mono">↗</span>
            </a>
            <a
              href={STOREFRONT_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md transition-colors"
            >
              <span>Storefront Demo</span>
              <span className="text-[10px] text-muted-foreground font-mono">↗</span>
            </a>
          </nav>
        </div>

        {/* Signed-in admin */}
        <div className="px-2 pt-4 border-t border-border">
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
    </>
  );
}
