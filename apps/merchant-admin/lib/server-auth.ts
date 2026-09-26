import { cookies } from 'next/headers';

/** Forwards the browser's cookies when a server component calls the API on the user's behalf. */
export async function serverAuthHeaders(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();
  return { headers: cookieHeader ? { cookie: cookieHeader } : {} };
}
