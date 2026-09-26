'use client';

import React, { useState, useEffect } from 'react';
import { getCustomers, getCustomerById, formatPrice, formatWhatsAppUrl, type MerchantCustomer } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function MerchantCustomersPage() {
  const [customers, setCustomers] = useState<MerchantCustomer[]>([]);
  const [filtered, setFiltered] = useState<MerchantCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<MerchantCustomer | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getCustomers();
      const list = Array.isArray(data) ? data : [];
      setCustomers(list);
      setFiltered(list);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(customers);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      customers.filter(
        (c) =>
          `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.email && c.email.toLowerCase().includes(q))
      )
    );
  }, [search, customers]);

  const handleSelectCustomer = async (cust: MerchantCustomer) => {
    const detail = await getCustomerById(cust.id);
    setSelectedCustomer(detail || cust);
  };

  // Metrics
  const totalLTV = customers.reduce((acc, c) => acc + c.totalSpentMinor, 0);
  const avgLTV = customers.length > 0 ? Math.round(totalLTV / customers.length) : 0;
  const repeatCount = customers.filter((c) => c.ordersCount > 1).length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-normal tracking-tight text-foreground">Customer CRM</h1>
          <p className="text-xs text-muted-foreground font-normal">
            Shopify-standard Customer 360, Lifetime Spend (LTV), repeat retention, and order history.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs h-8"
          />
        </div>
      </div>

      {/* 3 Calm CRM KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">Total Customers</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-medium text-foreground">{customers.length}</div>
            <p className="text-[11px] text-muted-foreground font-normal mt-0.5">Identified in Pakistan catalog</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">Repeat Buyers</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-medium text-foreground">{repeatCount}</div>
            <p className="text-[11px] text-emerald-500 font-normal mt-0.5">
              {customers.length > 0 ? Math.round((repeatCount / customers.length) * 100) : 0}% Repeat Customer Rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">Average Customer LTV</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-medium text-foreground">{formatPrice(avgLTV)}</div>
            <p className="text-[11px] text-muted-foreground font-normal mt-0.5">Average spend per buyer</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Directory Table */}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Contact & Phone</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Total Spent (LTV)</TableHead>
              <TableHead>Segment Tags</TableHead>
              <TableHead className="text-right">History</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                  Loading customer directory...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                  No customers found matching "{search}".
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((cust) => {
                const fullName = `${cust.firstName || ''} ${cust.lastName || ''}`.trim() || 'Guest Customer';
                const city = cust.defaultAddress?.city || 'Pakistan';
                return (
                  <TableRow key={cust.id}>
                    <TableCell>
                      <div className="text-xs text-foreground font-normal">{fullName}</div>
                      {cust.email && (
                        <div className="text-[10px] text-muted-foreground">{cust.email}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{cust.phone}</span>
                        {cust.phone && (
                          <a
                            href={formatWhatsAppUrl(cust.phone, `As-salamu alaykum ${fullName}, thank you for shopping with us!`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Chat on WhatsApp"
                            className="text-[11px] hover:text-emerald-500 transition-colors"
                          >
                            💬
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {city}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-foreground font-normal">
                      {cust.ordersCount} orders
                    </TableCell>
                    <TableCell className="text-xs text-foreground font-normal">
                      {formatPrice(cust.totalSpentMinor)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {cust.tags && cust.tags.length > 0 ? (
                          cust.tags.map((tag, i) => (
                            <Badge
                              key={i}
                              variant={tag === 'vip' ? 'success' : 'outline'}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {tag.toUpperCase()}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[10px] text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => handleSelectCustomer(cust)}
                        className="text-xs text-muted-foreground hover:text-foreground underline transition-colors cursor-pointer"
                      >
                        Profile 360 →
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Customer 360 Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg max-w-xl w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground font-mono">{selectedCustomer.phone}</p>
                  {selectedCustomer.phone && (
                    <a
                      href={formatWhatsAppUrl(
                        selectedCustomer.phone,
                        `As-salamu alaykum ${selectedCustomer.firstName || ''}, thank you for ordering with us!`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 hover:bg-emerald-500/20 font-medium"
                    >
                      <span>💬</span> WhatsApp Chat
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 p-3 rounded-md bg-muted/40 border border-border">
              <div>
                <div className="text-[10px] text-muted-foreground">Total Spent (LTV)</div>
                <div className="text-sm font-medium text-foreground">
                  {formatPrice(selectedCustomer.totalSpentMinor)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Orders Count</div>
                <div className="text-sm font-medium text-foreground">
                  {selectedCustomer.ordersCount}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Avg. Order Value</div>
                <div className="text-sm font-medium text-foreground">
                  {formatPrice(selectedCustomer.avgOrderValueMinor || 0)}
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedCustomer.notes && (
              <div className="p-3 rounded-md bg-muted/20 border border-border text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Merchant Note: </span>
                {selectedCustomer.notes}
              </div>
            )}

            {/* Order History */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-foreground">Order Timeline History</div>
              {selectedCustomer.orders && selectedCustomer.orders.length > 0 ? (
                <div className="space-y-2">
                  {selectedCustomer.orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 rounded-md border border-border bg-card flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-mono text-foreground font-normal">{ord.orderNumber}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(ord.createdAt || Date.now()).toLocaleDateString('en-PK', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-foreground">{formatPrice(ord.totalMinor)}</div>
                        <span className="text-[10px] uppercase font-mono text-muted-foreground">
                          {ord.paymentMethod}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground py-3 text-center">
                  Order details linked automatically upon storefront checkout.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-3 py-1.5 rounded-md border border-border bg-secondary text-xs text-foreground cursor-pointer hover:bg-muted"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
