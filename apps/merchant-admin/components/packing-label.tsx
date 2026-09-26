'use client';

import { useEffect, useState } from 'react';
import { formatPrice, getCurrentMerchant, type MerchantOrder } from '@/lib/api';

/**
 * 4x6 packing label for a booked order.
 * The consignment number is generated inside POSflow (there is no courier API integration yet),
 * so this is a packing label, not a courier-issued airway bill — it deliberately has no barcode.
 */
export function PackingLabel({ order, onClose }: { order: MerchantOrder; onClose: () => void }) {
  const [shipperName, setShipperName] = useState<string | null>(null);

  useEffect(() => {
    getCurrentMerchant()
      .then((me) => setShipperName(me.storeName))
      .catch(() => setShipperName(null));
  }, []);

  const pieces = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const isCod = order.paymentMethod === 'cod';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white text-zinc-950 rounded-lg max-w-sm w-full p-6 shadow-2xl font-mono text-xs border border-zinc-300">
        {/* Header */}
        <div className="border-b-2 border-black pb-3 text-center">
          <div className="text-base font-bold tracking-tight uppercase">
            {order.courierName ? `${order.courierName}${isCod ? ' (COD)' : ''}` : 'Courier not booked'}
          </div>
          <div className="text-[10px] text-zinc-600">PACKING LABEL (4x6)</div>
          <div className="mt-2 text-lg font-bold tracking-wider bg-zinc-100 py-1 border border-zinc-300 rounded">
            {order.courierTrackingNumber || 'NO CONSIGNMENT NUMBER'}
          </div>
          <div className="text-[9px] text-zinc-500 mt-1">
            Reference generated in POSflow — attach the courier&apos;s own airway bill before handover.
          </div>
        </div>

        {/* Recipient */}
        <div className="py-3 border-b border-dashed border-zinc-400 space-y-1">
          <div className="text-[10px] text-zinc-500 uppercase">Deliver To:</div>
          <div className="font-bold text-sm">{order.customerName}</div>
          <div>{order.shippingAddress}</div>
          {order.shippingAddressLine2 && <div>{order.shippingAddressLine2}</div>}
          <div className="font-bold">
            {order.customerCity}
            {order.shippingProvince ? `, ${order.shippingProvince}` : ''}
          </div>
          <div className="font-bold text-sm mt-1">{order.customerPhone}</div>
        </div>

        {/* Amount */}
        <div className="py-3 border-b-2 border-black flex justify-between items-center">
          <div>
            <div className="text-[10px] text-zinc-500 uppercase">Payment:</div>
            <div className="font-bold text-sm">{isCod ? 'CASH ON DELIVERY' : 'PREPAID'}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-zinc-500 uppercase">{isCod ? 'Collect Amount:' : 'Amount Due:'}</div>
            <div className="text-base font-bold text-black">{formatPrice(isCod ? order.totalMinor : 0)}</div>
          </div>
        </div>

        {/* Order ref, shipper, pieces */}
        <div className="py-2 text-[10px] text-zinc-600 space-y-0.5">
          <div>Order Ref: #{order.orderNumber}</div>
          <div>Shipper: {shipperName ?? '—'}</div>
          <div>Pieces: {pieces}</div>
        </div>

        {/* Actions */}
        <div className="mt-4 pt-3 border-t border-zinc-200 flex justify-between gap-2 font-sans">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded text-xs cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-black hover:bg-zinc-800 text-white rounded text-xs cursor-pointer font-medium"
          >
            Print Label
          </button>
        </div>
      </div>
    </div>
  );
}
