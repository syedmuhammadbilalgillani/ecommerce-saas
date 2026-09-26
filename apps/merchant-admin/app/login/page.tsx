'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, errorMessage } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorBanner } from '@/components/error-banner';

export default function MerchantLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-sm p-6 space-y-5">
      <div className="space-y-1">
        <h1 className="text-lg font-normal tracking-tight text-foreground">Merchant sign in</h1>
        <p className="text-xs text-muted-foreground">Manage your store&apos;s orders, catalog and customers.</p>
      </div>

      <ErrorBanner message={error} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={submitting} className="w-full text-xs font-normal h-9">
          {submitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </Card>
  );
}
