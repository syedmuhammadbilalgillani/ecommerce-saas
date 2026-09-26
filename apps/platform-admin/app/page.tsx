import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthError, getPlatformMetrics, getPlatformTenants, formatPrice } from '@/lib/api';
import { serverAuthHeaders } from '@/lib/server-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const revalidate = 0;

const MERCHANT_ADMIN_URL = process.env.NEXT_PUBLIC_MERCHANT_ADMIN_URL || 'http://localhost:3001';

export default async function PlatformAdminDashboard() {
  const auth = await serverAuthHeaders();
  let metrics, rawTenants;
  try {
    [metrics, rawTenants] = await Promise.all([getPlatformMetrics(auth), getPlatformTenants(auth)]);
  } catch (err) {
    if (err instanceof AuthError) redirect('/login');
    throw err;
  }

  const tenants = rawTenants;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl font-normal tracking-tight text-zinc-100">SaaS Platform Intelligence</h1>
          <p className="text-xs text-zinc-500 font-normal">
            Multi-tenant infrastructure monitoring, aggregated GMV throughput, and merchant fleet health.
          </p>
        </div>
        <Link
          href="/tenants"
          className="inline-flex items-center justify-center rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-normal text-zinc-950 hover:bg-zinc-200 transition-colors"
        >
          + Provision Tenant
        </Link>
      </div>

      {/* 4 Calm Platform KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/30 border-zinc-800/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-normal text-zinc-400">Platform ARR</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-medium text-zinc-100">
              {metrics.platformArrMinor === null ? '—' : formatPrice(metrics.platformArrMinor)}
            </div>
            <p className="text-[11px] text-zinc-500 font-normal mt-0.5">{metrics.platformArrMinor === null ? 'Billing not tracked yet' : 'Recurring SaaS subscriptions'}</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/30 border-zinc-800/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-normal text-zinc-400">Active Tenants</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-medium text-zinc-100">
              {metrics.totalTenants} brands
            </div>
            <p className="text-[11px] text-zinc-500 font-normal mt-0.5">{metrics.activeStores} active storefronts</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/30 border-zinc-800/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-normal text-zinc-400">Aggregated GMV</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-medium text-zinc-100">
              {formatPrice(metrics.monthlyGmvMinor)}
            </div>
            <p className="text-[11px] text-zinc-500 font-normal mt-0.5">Last 30 days, excluding cancelled</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/30 border-zinc-800/80">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-normal text-zinc-400">Fastify Core p95</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-medium text-emerald-400">
              {metrics.apiP95LatencyMs === null ? '—' : `${metrics.apiP95LatencyMs} ms`}
            </div>
            <p className="text-[11px] text-zinc-500 font-normal mt-0.5">{metrics.apiP95LatencyMs === null ? 'Latency telemetry not collected yet' : 'Target: < 20ms'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tenants Table Preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">Enrolled Merchant Tenants</h2>
            <p className="text-xs text-zinc-500 font-normal">Active customer brands using POSflow Commerce Engine.</p>
          </div>
          <Link href="/tenants" className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            Manage all ({tenants.length}) →
          </Link>
        </div>

        <div className="rounded-lg border border-zinc-800/80 overflow-hidden bg-zinc-900/20">
          <Table>
            <TableHeader className="bg-zinc-900/50">
              <TableRow>
                <TableHead>Tenant Brand</TableHead>
                <TableHead>Subscription Plan</TableHead>
                <TableHead>Storefronts</TableHead>
                <TableHead>Monthly GMV</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <div className="text-xs font-normal text-zinc-200">{tenant.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">slug: {tenant.slug ?? '—'}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] uppercase font-mono tracking-wider">
                      {tenant.plan ?? 'no plan'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-zinc-400">
                    {tenant.storesCount} active
                  </TableCell>
                  <TableCell className="text-xs font-mono text-zinc-300">
                    {formatPrice(tenant.monthlyGmvMinor)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tenant.status === 'active' ? 'success' : 'destructive'} className="text-[10px]">
                      {tenant.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <a
                      href={MERCHANT_ADMIN_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex text-[11px] text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded bg-zinc-800/60 border border-zinc-700/60 transition-colors"
                    >
                      Merchant portal ↗
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
