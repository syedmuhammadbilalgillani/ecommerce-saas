import { redirect } from 'next/navigation';

export default function AdminRedirect() {
  // Merchant admin runs on port 3001 as a standalone dedicated project
  redirect('http://localhost:3001');
}
