'use client';

import React, { useEffect, useState } from 'react';
import { changePassword, errorMessage, getStoreSettings, updateStoreSettings, type StoreSettings } from '@/lib/api';
import { Card, Button, Input, Label } from '@repo/ui';
import { ErrorBanner } from '@/components/error-banner';

function SuccessNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
      {message}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Store form
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [storeError, setStoreError] = useState<string | null>(null);
  const [storeSaved, setStoreSaved] = useState<string | null>(null);
  const [savingStore, setSavingStore] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    getStoreSettings()
      .then((s) => {
        setSettings(s);
        setName(s.name);
        setWhatsapp(s.whatsappPhone ?? '');
      })
      .catch((err) => setLoadError(errorMessage(err)));
  }, []);

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStore(true);
    setStoreError(null);
    setStoreSaved(null);
    try {
      const updated = await updateStoreSettings({ name: name.trim(), whatsappPhone: whatsapp.trim() || null });
      setSettings(updated);
      setName(updated.name);
      setWhatsapp(updated.whatsappPhone ?? '');
      setStoreSaved('Store settings saved. The storefront picks this up within a minute.');
    } catch (err) {
      setStoreError(errorMessage(err));
    } finally {
      setSavingStore(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(null);
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved('Password changed. Other devices have been signed out.');
    } catch (err) {
      setPasswordError(errorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-normal tracking-tight text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground font-normal">Store details shown to customers, and your account password.</p>
      </div>

      <ErrorBanner message={loadError} />

      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-foreground">Store details</h2>
          <p className="text-xs text-muted-foreground">
            The WhatsApp number is where customers send order confirmations from the storefront.
          </p>
        </div>
        <ErrorBanner message={storeError} />
        <SuccessNote message={storeSaved} />
        <form onSubmit={handleSaveStore} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="storeName">Store name</Label>
            <Input id="storeName" value={name} onChange={(e) => setName(e.target.value)} required disabled={!settings} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">WhatsApp number</Label>
            <Input
              id="whatsapp"
              type="tel"
              placeholder="03001234567 or +923001234567"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              disabled={!settings}
            />
            {!settings?.whatsappPhone && settings && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Not set — the storefront hides the WhatsApp confirmation button until you add one.
              </p>
            )}
          </div>
          {settings && (
            <p className="text-[11px] text-muted-foreground">
              Store URL slug: <span className="font-mono">{settings.slug}</span> · Currency: {settings.currency}
            </p>
          )}
          <Button type="submit" disabled={savingStore || !settings} className="text-xs font-normal h-8">
            {savingStore ? 'Saving...' : 'Save store details'}
          </Button>
        </form>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-foreground">Change password</h2>
          <p className="text-xs text-muted-foreground">At least 10 characters. You stay signed in here; other devices are signed out.</p>
        </div>
        <ErrorBanner message={passwordError} />
        <SuccessNote message={passwordSaved} />
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={savingPassword} className="text-xs font-normal h-8">
            {savingPassword ? 'Changing...' : 'Change password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
