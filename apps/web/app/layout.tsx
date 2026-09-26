import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '../lib/cart-context';
import { HeaderNav } from '../components/header-nav';
import { CartDrawer } from '../components/cart-drawer';

export const metadata: Metadata = {
  title: 'NextCommerce | Sub-Second Headless Storefront',
  description: 'Ultra-fast multi-tenant commerce storefront powered by Next.js 15 & Fastify.',
};

export default function RootLayout({
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
      <body suppressHydrationWarning>
        <CartProvider>
          <HeaderNav />
          <main>{children}</main>
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
