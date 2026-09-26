import type { Metadata } from 'next';
import { getStoreInfo, type StoreInfo } from '../lib/api';
import './globals.css';
import { CartProvider } from '../lib/cart-context';
import { HeaderNav } from '../components/header-nav';
import { CartDrawer } from '../components/cart-drawer';

async function loadStore(): Promise<StoreInfo | null> {
  // The header must still render if the store call fails; pages surface their own errors.
  try {
    return await getStoreInfo();
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const store = await loadStore();
  return {
    title: store?.name ?? 'Online Store',
    description: store ? `Shop ${store.name} online — Cash on Delivery across Pakistan.` : undefined,
  };
}

export default async function RootLayout({
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
          <HeaderNav storeName={(await loadStore())?.name ?? null} />
          <main>{children}</main>
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
