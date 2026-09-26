'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';

function ImpersonateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing impersonation token.');
      return;
    }

    let active = true;
    fetch('/api/v1/auth/exchange-impersonation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.message || `Impersonation failed (${res.status})`);
        }
        if (active) {
          router.replace('/');
          router.refresh();
        }
      })
      .catch((err) => {
        if (active) {
          setError(errorMessage(err));
        }
      });

    return () => {
      active = false;
    };
  }, [token, router]);

  if (error) {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md p-6 space-y-4 border-destructive/40 bg-destructive/5">
          <div className="space-y-1">
            <h1 className="text-base font-medium text-destructive">Impersonation Authorization Failed</h1>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          <div className="pt-2">
            <Link href="/login">
              <Button variant="outline" size="sm" className="text-xs">
                Back to Merchant Login
              </Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex-1 min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm p-6 space-y-3 text-center">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto mb-2" />
        <h2 className="text-sm font-medium text-foreground">Authorizing Platform Support Access…</h2>
        <p className="text-xs text-muted-foreground">Logging you in as merchant. You will be redirected momentarily.</p>
      </Card>
    </main>
  );
}

export default function ImpersonatePage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 min-h-screen flex items-center justify-center bg-background p-6">
          <p className="text-xs text-muted-foreground">Loading session…</p>
        </main>
      }
    >
      <ImpersonateContent />
    </Suspense>
  );
}
