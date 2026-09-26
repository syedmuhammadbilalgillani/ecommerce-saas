import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'Platform Admin | POSflow SaaS Super Admin',
  description: 'Global SaaS multi-tenant control panel, billing subscriptions, and platform telemetry',
};

export default function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var stored = localStorage.getItem('posflow-theme');
                if (stored === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            })()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground flex font-sans antialiased text-sm">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
