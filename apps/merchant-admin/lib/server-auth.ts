import { cookies } from 'next/headers';

/** Forwards the browser's cookies and active store when a server component calls the API on the user's behalf. */
export async function serverAuthHeaders(): Promise<RequestInit> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const activeStore = cookieStore.get('posflow_active_store')?.value;
  const headers: Record<string, string> = {};
  if (cookieHeader) headers.cookie = cookieHeader;
  if (activeStore) headers['x-store-id'] = activeStore;
  return { headers };
}
