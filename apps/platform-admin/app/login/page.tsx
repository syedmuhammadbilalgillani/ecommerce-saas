'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, errorMessage } from '@/lib/api';
import { Card, Button, Input, Label } from '@repo/ui';

export default function PlatformLoginPage() {
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
        <h1 className="text-lg font-normal tracking-tight text-foreground">Platform admin sign in</h1>
        <p className="text-xs text-muted-foreground">POSflow Cloud super admin console.</p>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

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
