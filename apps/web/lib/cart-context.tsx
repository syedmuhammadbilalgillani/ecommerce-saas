'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL, storefrontHeaders } from './api';
const CART_ID_KEY = 'posflow_cart_id';

export interface CartItem {
  id: string;
  variantId: string;
  productId: string;
  title: string;
  variantTitle: string;
  sku: string;
  priceMinor: number;
  quantity: number;
  totalMinor: number;
}

export interface Cart {
  id: string;
  storeId: string;
  currency: string;
  itemCount: number;
  subtotalMinor: number;
  items: CartItem[];
}

interface CartContextType {
  cart: Cart | null;
  isOpen: boolean;
  isLoading: boolean;
  /** Last cart error to show the shopper; null when the last action succeeded. */
  error: string | null;
  openCart: () => void;
  closeCart: () => void;
  addItem: (variantId: string, quantity?: number) => Promise<boolean>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => void;
  clearError: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function readCartId(): string | undefined {
  try {
    return localStorage.getItem(CART_ID_KEY) || undefined;
  } catch {
    return undefined;
  }
}

function writeCartId(id: string | null) {
  try {
    if (id) localStorage.setItem(CART_ID_KEY, id);
    else localStorage.removeItem(CART_ID_KEY);
    // Clean up the old offline cache: carts are server-authoritative now.
    localStorage.removeItem('posflow_cart_data');
  } catch {}
}

/** Sends a cart request and returns the server's cart. Throws with a shopper-readable message. */
async function cartRequest(path: string, init: RequestInit = {}): Promise<Cart> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1/storefront/cart${path}`, {
      ...init,
      headers: storefrontHeaders(init.headers as Record<string, string> | undefined),
    });
  } catch {
    throw new Error('Could not reach the store. Please check your connection and try again.');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.data) {
    throw new Error(json?.message || 'Something went wrong with your cart. Please try again.');
  }
  return json.data as Cart;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<Cart>): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await action();
      setCart(next);
      writeCartId(next.id);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong with your cart.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedCartId = readCartId();
    run(() => cartRequest('', { headers: savedCartId ? { 'x-cart-id': savedCartId } : {} }));
  }, [run]);

  const addItem = async (variantId: string, quantity: number = 1) => {
    const cartId = cart?.id || readCartId();
    const ok = await run(() =>
      cartRequest('/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cartId ? { 'x-cart-id': cartId } : {}),
        },
        body: JSON.stringify({ variantId, quantity }),
      })
    );
    if (ok) setIsOpen(true);
    return ok;
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (!cart?.id) return;
    await run(() =>
      cartRequest(`/items/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-cart-id': cart.id },
        body: JSON.stringify({ quantity }),
      })
    );
  };

  const removeItem = async (itemId: string) => {
    if (!cart?.id) return;
    await run(() =>
      cartRequest(`/items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
        headers: { 'x-cart-id': cart.id },
      })
    );
  };

  const clearCart = () => {
    setCart(null);
    writeCartId(null);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        isOpen,
        isLoading,
        error,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        clearError: () => setError(null),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
