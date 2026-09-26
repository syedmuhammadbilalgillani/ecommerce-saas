'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getStoreSettings, type StoreSettings } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const NICHE_PRESETS = [
  { id: 'apparel_eastern', label: 'Eastern & Traditional Wear (Kurti, Shalwar Kameez, Unstitched)' },
  { id: 'apparel_western', label: 'Western Streetwear & Casual (Oversized Tees, Hoodies, Denim)' },
  { id: 'perfumes', label: 'Luxury Perfumes, Attars & Fragrances (EDP, Oud, Decants)' },
  { id: 'skincare', label: 'Organic Skincare, Cosmetics & Haircare (Serums, Sunblock, Lip Tints)' },
  { id: 'footwear', label: 'Footwear & Leather Goods (Peshawari Chappal, Sneakers, Wallets)' },
  { id: 'electronics', label: 'Electronics & Smart Tech (TWS Earbuds, Powerbanks, Chargers)' },
  { id: 'jewelry', label: 'Jewelry & Watches (Custom Pendants, Rings, Timepieces)' },
  { id: 'home_decor', label: 'Home Decor & Bedding (Bedsheets, Cushions, Scented Candles)' },
  { id: 'custom', label: 'Custom / Other Niche...' },
];

const AESTHETIC_PRESETS = [
  {
    id: 'minimal_luxury',
    name: 'Minimalist Luxury & Editorial',
    desc: 'Clean serif typography, generous whitespace, subtle borders, high-end editorial feel (Zara/COS inspired).',
    primary: '#111827',
    accent: '#B45309',
    bgStyle: 'Clean Cream / Off-White',
  },
  {
    id: 'streetwear_bold',
    name: 'Bold & High-Energy Streetwear',
    desc: 'High contrast, uppercase display headers, dynamic hover states, bold sticker badges, urban edge.',
    primary: '#09090B',
    accent: '#E11D48',
    bgStyle: 'Deep Charcoal / Pitch Black',
  },
  {
    id: 'royal_heritage',
    name: 'Royal Pakistani Heritage',
    desc: 'Warm gold metallic accents, rich emerald or maroon jewel tones, ornate borders, cultural luxury.',
    primary: '#064E3B',
    accent: '#D97706',
    bgStyle: 'Warm Ivory / Soft Gold',
  },
  {
    id: 'tech_cyber',
    name: 'Modern Cyber & Tech Dark',
    desc: 'Sleek dark mode, crisp sans-serif, electric teal or cyan highlights, technical spec tables.',
    primary: '#0F172A',
    accent: '#06B6D4',
    bgStyle: 'Slate 950 Dark Mode',
  },
  {
    id: 'organic_botanical',
    name: 'Fresh, Organic & Botanical',
    desc: 'Soft sage greens, warm earth tones, rounded cards, wholesome sustainable photography vibe.',
    primary: '#1C3E2F',
    accent: '#10B981',
    bgStyle: 'Soft Linen / Warm Beige',
  },
  {
    id: 'custom',
    name: 'Custom Aesthetic',
    desc: 'Define your own aesthetic details, tone, and brand personality.',
    primary: '#18181B',
    accent: '#3B82F6',
    bgStyle: 'Custom',
  },
];

export default function StorefrontAiPage() {
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'prompt' | 'api' | 'strategy'>('prompt');
  const [copied, setCopied] = useState(false);

  // Customization Form State
  const [storeName, setStoreName] = useState('');
  const [storeTagline, setStoreTagline] = useState('');
  const [selectedNiche, setSelectedNiche] = useState('apparel_eastern');
  const [customNiche, setCustomNiche] = useState('');
  const [selectedAesthetic, setSelectedAesthetic] = useState('minimal_luxury');
  const [customAesthetic, setCustomAesthetic] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#111827');
  const [accentColor, setAccentColor] = useState('#D97706');
  const [targetAudience, setTargetAudience] = useState(
    'Pakistani mobile shoppers discovering products on Instagram & TikTok. 85%+ Cash-on-Delivery (COD) preference. Needs instant reassurance on 2-4 days courier delivery, 7-day exchange, and direct WhatsApp support.'
  );

  // USPs
  const [usp1, setUsp1] = useState('Cash on Delivery (COD) Across Pakistan');
  const [usp2, setUsp2] = useState('24-48 Hours Express Dispatch');
  const [usp3, setUsp3] = useState('7-Day Hassle-Free Exchange Policy');
  const [usp4, setUsp4] = useState('100% Genuine Guaranteed Quality');

  // Conversion Features
  const [features, setFeatures] = useState({
    codOnePageCheckout: true,
    whatsAppInquiry: true,
    whatsAppVerification: true,
    mobileStickyBar: true,
    freeShippingMeter: true,
    stockUrgency: true,
    sizeGuide: true,
    customerReviews: true,
  });

  const [techStack, setTechStack] = useState('Next.js 15/16 App Router + Tailwind CSS + Lucide Icons');

  useEffect(() => {
    getStoreSettings()
      .then((s) => {
        setStore(s);
        setStoreName(s.name);
        setStoreTagline(`Premium ${s.name} Official Online Store`);
      })
      .catch(() => {
        setStoreName('My Store');
        setStoreTagline('Premium Official Online Store');
      });
  }, []);

  const handleAestheticChange = (id: string) => {
    setSelectedAesthetic(id);
    const preset = AESTHETIC_PRESETS.find((p) => p.id === id);
    if (preset && id !== 'custom') {
      setPrimaryColor(preset.primary);
      setAccentColor(preset.accent);
    }
  };

  const currentNicheLabel = useMemo(() => {
    if (selectedNiche === 'custom') return customNiche || 'Custom E-Commerce Store';
    return NICHE_PRESETS.find((n) => n.id === selectedNiche)?.label || selectedNiche;
  }, [selectedNiche, customNiche]);

  const currentAestheticName = useMemo(() => {
    if (selectedAesthetic === 'custom') return customAesthetic || 'Custom Tailored Aesthetic';
    return AESTHETIC_PRESETS.find((a) => a.id === selectedAesthetic)?.name || selectedAesthetic;
  }, [selectedAesthetic, customAesthetic]);

  const currentAestheticDesc = useMemo(() => {
    if (selectedAesthetic === 'custom') return customAesthetic || 'Bespoke design theme';
    return AESTHETIC_PRESETS.find((a) => a.id === selectedAesthetic)?.desc || '';
  }, [selectedAesthetic, customAesthetic]);

  const activeStoreId = store?.slug || 'store_default';
  const activeWhatsApp = store?.whatsappPhone || '+923001234567';

  // Master Prompt Generator
  const masterPrompt = useMemo(() => {
    return `# 🛍️ Complete E-Commerce Storefront Specification & Design Blueprint

You are an expert Senior Full-Stack E-Commerce Architect and Award-Winning UI/UX Designer.
Your task is to build a complete, production-ready, high-converting E-Commerce storefront for **${storeName || 'My Brand'}**.

---

## 1. Brand Identity & Business Context
* **Store Name:** ${storeName || 'My Brand'}
* **Tagline:** ${storeTagline || 'Official Online Store'}
* **Business Niche & Products:** ${currentNicheLabel}
* **Design Aesthetic & Vibe:** ${currentAestheticName} — ${currentAestheticDesc}
* **Primary Brand Color:** \`${primaryColor}\` (Buttons, headers, dominant elements)
* **Accent / Highlight Color:** \`${accentColor}\` (Badges, savings tags, CTAs, highlights)
* **Target Audience:** ${targetAudience}
* **Core Value Propositions (USPs):**
  1. ${usp1}
  2. ${usp2}
  3. ${usp3}
  4. ${usp4}
* **Technology Stack:** ${techStack}
* **Multi-Tenancy Store Identifier:** \`${activeStoreId}\`
* **Official WhatsApp Support:** \`${activeWhatsApp}\`

---

## 2. Fundamental Architectural Rules & Invariants
You **MUST** strictly adhere to these 6 core invariants without deviation:

1. **Integer Money Representation (\`*_minor\`):**
   * All prices returned by the API are integers in **minor currency units (paisas/cents)**. 1 PKR = 100 minor units.
   * Example: \`priceMinor: 245000\` represents **Rs. 2,450.00**.
   * Always format via: \`(priceMinor / 100).toLocaleString('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 })\`.
   * **NEVER** store or transmit floating-point currencies.
2. **Multi-Tenancy Scoping (\`x-store-id\` header):**
   * Every single API request to the backend **MUST** pass the header:
     \`\`\`http
     x-store-id: ${activeStoreId}
     \`\`\`
   * The API uses this header to route requests to the correct store catalog and stock inventory.
3. **Shopper Cart Persistence (\`x-cart-id\` header):**
   * Carts belong to anonymous shoppers. Store the \`cartId\` in \`localStorage\` or cookies (\`posflow_cart_id\`).
   * Pass \`x-cart-id: <cartId>\` on all cart and checkout requests.
4. **Order Access Token (\`x-order-token\` header):**
   * Upon successful checkout, the API returns the created order along with a one-time cryptographic \`accessToken\`.
   * The order confirmation page (\`/order-confirmation/:id?token=...\`) **MUST** send this token in the header:
     \`\`\`http
     x-order-token: <accessToken>
     \`\`\`
   * Unauthenticated requests to view an order will receive a \`404 Not Found\` to protect customer PII.
5. **Atomic Stock & Race-Safety:**
   * Never permit shoppers to add more quantity to their cart than is currently available in \`variant.stock\`.
   * If checkout encounters out-of-stock items, the API returns \`409 Conflict\` with an \`outOfStock\` array. Display a friendly notification.
6. **Pakistani Phone Number Normalization:**
   * Customer mobile numbers must be valid Pakistani numbers (\`03XXXXXXXXX\` or \`+923XXXXXXXXX\`).

---

## 3. Pages & UI/UX Component Specifications

### Page 1: Homepage (\`/\`)
* **Top Announcement Bar:** Subtle animated bar highlighting "${usp1}" with optional coupon code announcement.
* **Header / Navigation:**
  * Brand Logo (${storeName})
  * Navigation links: *New Arrivals, Collections, Best Sellers, About Us*
  * Search icon / input
  * Slide-over Cart Drawer toggle with dynamic item count badge
  * WhatsApp direct chat button
* **Hero Banner:**
  * High-impact hero section tailored to **${currentNicheLabel}**.
  * Headline reflecting "${storeTagline}".
  * Primary CTA: *"Shop Latest Drop"* -> scrolls to catalog or links to \`/collections\`.
  * Secondary CTA: *"Explore Best Sellers"*.
* **Trust & Value Bar:** 4 responsive icon cards highlighting the USPs (${usp1}, ${usp2}, etc.).
* **Featured Collections Grid:** Visual category cards with hover zoom effects.
* **Trending & Best Sellers Section:** 4-column responsive grid with quick "Add to Cart" and discount percentage badges.
${features.customerReviews ? '* **Customer Reviews & Social Proof:** Testimonials carousel with 5-star ratings from verified buyers.\n' : ''}* **Footer:** Store information, Quick Links, Payment methods (Cash on Delivery, Bank Transfer), WhatsApp support contact, Copyright.

### Page 2: Catalog & Collections (\`/collections\` & \`/collections/[slug]\`)
* **Collection Header:** Title, description, and total product count.
* **Filter & Sort Toolbar:**
  * Sort dropdown: *Price: Low to High, Price: High to Low, Newest, Title A-Z*.
  * Category / Tag chips.
* **Product Grid:** 2 columns on mobile, 3–4 columns on desktop.
* **Product Card Component:**
  * Product image with hover state.
  * Vendor / Brand label.
  * Title with line-clamp.
  * Formatted PKR Price + strikethrough \`compareAtPrice\` with "Save X%" pill.
  * Low stock indicator if stock <= 5.
  * Quick Add button.

### Page 3: Product Detail Page - PDP (\`/products/[slug]\`)
* **Breadcrumbs:** \`Home > Collections > [Category] > [Product Title]\`.
* **Gallery:** Primary high-res image with interactive thumbnail carousel.
* **Product Details:**
  * Title, Category, and SKU.
  * Price Display: Current price in bold PKR + Compare-at price + Calculated Savings.
  * Stock Status Badge: "In Stock (Ships in 24h)" or "Only X units left" or "Sold Out".
  * **Variant Selector:** Interactive pills or swatches for Size / Color / Style. Automatically updates current price, SKU, and stock upon selection.
  * **Quantity Counter:** \`[-]\` and \`[+]\` buttons, strictly bounded between 1 and available stock.
  * **Action Buttons:**
    1. **"Add to Cart"** (Primary button — shows loading spinner, opens Cart Drawer on success).
    2. **"Buy Now via Cash on Delivery"** (Direct checkout with single item).
${features.mobileStickyBar ? '  * **Mobile Sticky Purchase Bar:** Fixed bottom bar on mobile screens showing price, selected variant, and "Buy with COD" button.\n' : ''}${features.whatsAppInquiry ? `  * **Direct WhatsApp Inquire Button:** Pre-fills message: *"Assalam-o-Alaikum, I want to inquire about ${storeName} product: [Title] (SKU: [SKU])"*\n` : ''}${features.sizeGuide ? '  * **Size Guide Modal:** Sizing measurement table (Chest, Length, Shoulders) with visual fit guide.\n' : ''}  * **Product Information Accordions:** Detailed Description, Shipping & COD Policy, Return & Exchange Rules.

### Page 4: Cart Slide-Over Drawer (\`/cart\`)
* Slides smoothly from the right when toggled or when an item is added.
${features.freeShippingMeter ? '* **Free Delivery Progress Bar:** Shows progress (e.g. *"Add Rs. 600 more to unlock FREE Shipping Across Pakistan!"*).\n' : ''}* **Cart Items List:**
  * Thumbnail, Title, Variant Title, Unit Price.
  * Quantity adjusters (\`+\` / \`-\`) and Delete button.
* **Order Summary:**
  * Subtotal (PKR)
  * Estimated Shipping (Free or standard)
* **Promo / Coupon Code Input:** Real-time validation via \`POST /v1/storefront/discounts/validate\`.
* **Proceed to Checkout Button:** Prominent, full-width CTA.

### Page 5: 1-Page Cash on Delivery Checkout (\`/checkout\`)
* Optimized specifically for the Pakistani E-Commerce market:
* **2-Column Layout:**
  * **Left Column: Customer & Delivery Details:**
    * Full Name (required)
    * Mobile Number (required, formatted: \`03XXXXXXXXX\`, with Pakistani flag icon)
    * Email Address (optional)
    * Delivery Address (Street, House/Apartment No, Area)
    * City Selector: Quick dropdown of major cities (*Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, Peshawar, Multan, Sialkot, Quetta, Other*)
    * Order Notes / Delivery Instructions (e.g. "Call before arrival")
    * Payment Method: Pre-selected **"Cash on Delivery (COD)"** with trust badge.
  * **Right Column: Order Summary:**
    * List of cart items with quantities and totals.
    * Discount Code input with coupon chip display.
    * Subtotal, Discount amount, Delivery fee, and **Final Total Payable**.
* **Place Order Button:** High-contrast CTA *"Confirm Order (Pay on Delivery)"* with anti-double-submission prevention.

### Page 6: Order Confirmation & Tracking (\`/order-confirmation/[id]\`)
* **Success Hero:** Checkmark animation + "Thank you for your order, [Customer Name]!".
* **Order Tracking Badge:** Displays Order Number (e.g. \`PF-10024\`) and status (*Unverified*, *Pending Dispatch*, etc.).
${features.whatsAppVerification ? `* **WhatsApp Order Confirmation:** Button triggering \`POST /v1/storefront/orders/:id/verify-whatsapp\` and opening WhatsApp to confirm delivery address with customer support.\n` : ''}* **Delivery Details Card:** Shipping address, phone number, and estimated arrival (2-4 business days).
* **Summary Table:** Breakdown of items, subtotal, and total amount payable in cash to courier.

---

## 4. Complete Storefront API Specification

Base URL: \`http://127.0.0.1:4000\` (or your configured \`NEXT_PUBLIC_API_URL\`)
All requests **MUST** include:
\`\`\`http
x-store-id: ${activeStoreId}
\`\`\`

### 1. Get Store Info
\`\`\`http
GET /v1/storefront/store
\`\`\`
**Response 200:**
\`\`\`json
{
  "success": true,
  "data": {
    "id": "${activeStoreId}",
    "name": "${storeName}",
    "currency": "PKR",
    "whatsappPhone": "${activeWhatsApp}"
  }
}
\`\`\`

### 2. List Published Products
\`\`\`http
GET /v1/storefront/products
\`\`\`
**Response 200:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "id": "prod_123",
      "title": "Classic Linen Kurti",
      "slug": "classic-linen-kurti",
      "description": "Premium summer linen with intricate neckline detailing.",
      "productType": "Apparel",
      "vendor": "${storeName}",
      "tags": ["summer", "new-arrival"],
      "isPublished": true,
      "variants": [
        {
          "id": "var_456",
          "title": "Small / Olive Green",
          "sku": "KURTI-S-GRN",
          "priceMinor": 285000,
          "compareAtPriceMinor": 350000,
          "stock": 14
        }
      ]
    }
  ]
}
\`\`\`

### 3. Get Single Product by Slug
\`\`\`http
GET /v1/storefront/products/:slug
\`\`\`

### 4. List Collections
\`\`\`http
GET /v1/storefront/collections
\`\`\`

### 5. Get Single Collection with Products
\`\`\`http
GET /v1/storefront/collections/:slug
\`\`\`

### 6. Get Shopper Cart
\`\`\`http
GET /v1/storefront/cart
Headers:
  x-store-id: ${activeStoreId}
  x-cart-id: <cart_id>
\`\`\`
**Response 200:**
\`\`\`json
{
  "success": true,
  "data": {
    "id": "cart_abc123",
    "currency": "PKR",
    "subtotalMinor": 285000,
    "items": [
      {
        "id": "item_789",
        "variantId": "var_456",
        "quantity": 1,
        "variant": {
          "id": "var_456",
          "title": "Small / Olive Green",
          "priceMinor": 285000,
          "stock": 14,
          "product": {
            "title": "Classic Linen Kurti",
            "slug": "classic-linen-kurti"
          }
        }
      }
    ]
  }
}
\`\`\`

### 7. Add Item to Cart
\`\`\`http
POST /v1/storefront/cart/items
Headers:
  x-store-id: ${activeStoreId}
  x-cart-id: <cart_id> (Optional for first item; API creates cart and returns id)
Body:
{
  "variantId": "var_456",
  "quantity": 1
}
\`\`\`

### 8. Update Cart Item Quantity
\`\`\`http
PATCH /v1/storefront/cart/items/:itemId
Headers:
  x-store-id: ${activeStoreId}
  x-cart-id: <cart_id>
Body:
{
  "quantity": 2
}
\`\`\`

### 9. Remove Item from Cart
\`\`\`http
DELETE /v1/storefront/cart/items/:itemId
Headers:
  x-store-id: ${activeStoreId}
  x-cart-id: <cart_id>
\`\`\`

### 10. Validate Discount Code
\`\`\`http
POST /v1/storefront/discounts/validate
Headers:
  x-store-id: ${activeStoreId}
Body:
{
  "code": "WELCOME10",
  "subtotalMinor": 285000
}
\`\`\`
**Response 200:**
\`\`\`json
{
  "success": true,
  "data": {
    "code": "WELCOME10",
    "discountType": "percentage",
    "value": 10,
    "discountAmountMinor": 28500,
    "message": "10% discount applied!"
  }
}
\`\`\`

### 11. Place Cash-on-Delivery (COD) Order
\`\`\`http
POST /v1/storefront/orders/checkout
Headers:
  x-store-id: ${activeStoreId}
  x-cart-id: <cart_id>
Body:
{
  "cartId": "cart_abc123",
  "customerName": "Hamza Ali",
  "customerPhone": "03001234567",
  "customerEmail": "hamza@example.com",
  "shippingAddressLine1": "House 45, Street 12, Phase 5 DHA",
  "shippingCity": "Lahore",
  "paymentMethod": "cod",
  "discountCode": "WELCOME10",
  "notes": "Please call before delivery"
}
\`\`\`
**Response 201:**
\`\`\`json
{
  "success": true,
  "data": {
    "id": "ord_998877",
    "orderNumber": "PF-10024",
    "accessToken": "tok_sec_1122334455",
    "totalMinor": 256500,
    "paymentMethod": "cod",
    "orderStatus": "unverified",
    "financialStatus": "pending",
    "fulfillmentStatus": "unfulfilled"
  }
}
\`\`\`

### 12. Get Order Details (Requires Token)
\`\`\`http
GET /v1/storefront/orders/:id
Headers:
  x-store-id: ${activeStoreId}
  x-order-token: tok_sec_1122334455
\`\`\`

### 13. WhatsApp Order Verification
\`\`\`http
POST /v1/storefront/orders/:id/verify-whatsapp
Headers:
  x-store-id: ${activeStoreId}
  x-order-token: tok_sec_1122334455
\`\`\`

---

## 5. Starter API Client Code Example (TypeScript)

Provide clean, modular code. Here is the recommended API client foundation:

\`\`\`typescript
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
export const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID || '${activeStoreId}';

export function storefrontHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'x-store-id': STORE_ID,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export function formatPKR(minorAmount: number): string {
  const major = minorAmount / 100;
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(major);
}
\`\`\`

---

## 6. Execution Instructions for the AI
1. **Design Quality:** Use modern Tailwind CSS styling matching **${currentAestheticName}**. Implement smooth animations, clean typography, and mobile-first touch optimization.
2. **Honesty Invariant:** Connect directly to the real API endpoints above. **DO NOT** use hardcoded mock products, fake analytics, or dummy carts.
3. **Responsive Execution:** Ensure mobile experience is lightning fast with sticky buy buttons and thumb-friendly checkout fields.
4. Output complete, working components with full TypeScript types.
`;
  }, [
    storeName,
    storeTagline,
    currentNicheLabel,
    currentAestheticName,
    currentAestheticDesc,
    primaryColor,
    accentColor,
    targetAudience,
    usp1,
    usp2,
    usp3,
    usp4,
    techStack,
    activeStoreId,
    activeWhatsApp,
    features,
  ]);

  const handleCopy = () => {
    navigator.clipboard.writeText(masterPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const blob = new Blob([masterPrompt], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-storefront-ai-blueprint.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">AI Storefront Studio</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Prompt Generator
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Generate an exhaustive, battle-tested AI prompt tailored to your business niche, visual branding, and
            Pakistani COD market requirements. Feed this prompt into <strong>Claude 3.7</strong>, <strong>ChatGPT 4o</strong>,{' '}
            <strong>Cursor</strong>, or <strong>v0.dev</strong> to create a complete custom storefront connected to your live POSflow catalog.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="text-xs gap-1.5"
            title="Download full blueprint as Markdown (.md)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download .md</span>
          </Button>

          <Button
            size="sm"
            onClick={handleCopy}
            className={`text-xs gap-1.5 transition-all ${
              copied
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy Master AI Prompt</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-border text-xs">
        <button
          onClick={() => setActiveTab('prompt')}
          className={`px-3 py-2 font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'prompt'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          1. Customize & Master Prompt
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`px-3 py-2 font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'api'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          2. Storefront API Reference (13 Endpoints)
        </button>
        <button
          onClick={() => setActiveTab('strategy')}
          className={`px-3 py-2 font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'strategy'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          3. Pakistan COD & Conversion Guide
        </button>
      </div>

      {/* TAB 1: CUSTOMIZER & MASTER PROMPT */}
      {activeTab === 'prompt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form: Customizer */}
          <div className="lg:col-span-5 space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Store & Business Setup</CardTitle>
                <CardDescription className="text-xs">
                  Fill in your business details. The AI prompt on the right updates in real-time.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Store Name & Tagline */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label className="text-xs">Store Name</Label>
                    <Input
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="e.g. Royal Attire PK"
                      className="text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Brand Tagline / Slogan</Label>
                    <Input
                      value={storeTagline}
                      onChange={(e) => setStoreTagline(e.target.value)}
                      placeholder="e.g. Premium Handcrafted Eastern Wear"
                      className="text-xs mt-1"
                    />
                  </div>
                </div>

                {/* Business Niche */}
                <div>
                  <Label className="text-xs">Business Niche & Industry</Label>
                  <select
                    value={selectedNiche}
                    onChange={(e) => setSelectedNiche(e.target.value)}
                    className="w-full text-xs mt-1 bg-muted/60 border border-border rounded px-2.5 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {NICHE_PRESETS.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>

                  {selectedNiche === 'custom' && (
                    <Input
                      value={customNiche}
                      onChange={(e) => setCustomNiche(e.target.value)}
                      placeholder="Describe what products you sell..."
                      className="text-xs mt-2"
                    />
                  )}
                </div>

                {/* Aesthetic Theme */}
                <div>
                  <Label className="text-xs">Visual Aesthetic & Tone</Label>
                  <select
                    value={selectedAesthetic}
                    onChange={(e) => handleAestheticChange(e.target.value)}
                    className="w-full text-xs mt-1 bg-muted/60 border border-border rounded px-2.5 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {AESTHETIC_PRESETS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>

                  {selectedAesthetic === 'custom' && (
                    <Input
                      value={customAesthetic}
                      onChange={(e) => setCustomAesthetic(e.target.value)}
                      placeholder="e.g. Vintage Retro 90s, pastel colors, scrapbook style"
                      className="text-xs mt-2"
                    />
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1.5">{currentAestheticDesc}</p>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <Label className="text-xs flex items-center gap-1.5">
                      <span>Primary Brand Color</span>
                      <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: primaryColor }} />
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="text-xs uppercase font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1.5">
                      <span>Accent / CTA Color</span>
                      <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: accentColor }} />
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                      />
                      <Input
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="text-xs uppercase font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Target Audience */}
                <div>
                  <Label className="text-xs">Target Audience & Market Strategy</Label>
                  <textarea
                    rows={3}
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="w-full text-xs mt-1 bg-muted/60 border border-border rounded px-2.5 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                </div>

                {/* USPs */}
                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-semibold">Store Trust Badges (4 USPs)</Label>
                  <Input value={usp1} onChange={(e) => setUsp1(e.target.value)} className="text-xs" />
                  <Input value={usp2} onChange={(e) => setUsp2(e.target.value)} className="text-xs" />
                  <Input value={usp3} onChange={(e) => setUsp3(e.target.value)} className="text-xs" />
                  <Input value={usp4} onChange={(e) => setUsp4(e.target.value)} className="text-xs" />
                </div>

                {/* High-Conversion CRO Toggles */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="text-xs font-semibold block mb-1">Conversion Features to Include</Label>
                  <div className="space-y-1.5 text-xs text-foreground">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={features.codOnePageCheckout}
                        onChange={(e) => setFeatures({ ...features, codOnePageCheckout: e.target.checked })}
                        className="rounded border-border"
                      />
                      <span>1-Page Pakistani COD Fast Checkout</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={features.whatsAppInquiry}
                        onChange={(e) => setFeatures({ ...features, whatsAppInquiry: e.target.checked })}
                        className="rounded border-border"
                      />
                      <span>Direct WhatsApp Product Inquiry Button</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={features.whatsAppVerification}
                        onChange={(e) => setFeatures({ ...features, whatsAppVerification: e.target.checked })}
                        className="rounded border-border"
                      />
                      <span>One-Click WhatsApp Order Confirmation</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={features.mobileStickyBar}
                        onChange={(e) => setFeatures({ ...features, mobileStickyBar: e.target.checked })}
                        className="rounded border-border"
                      />
                      <span>Mobile Sticky Purchase Bar (Add to Cart / COD)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={features.freeShippingMeter}
                        onChange={(e) => setFeatures({ ...features, freeShippingMeter: e.target.checked })}
                        className="rounded border-border"
                      />
                      <span>Free Shipping Progress Meter in Cart Drawer</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={features.stockUrgency}
                        onChange={(e) => setFeatures({ ...features, stockUrgency: e.target.checked })}
                        className="rounded border-border"
                      />
                      <span>Real-Time Stock Scarcity Indicators (&quot;Only 3 left!&quot;)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={features.sizeGuide}
                        onChange={(e) => setFeatures({ ...features, sizeGuide: e.target.checked })}
                        className="rounded border-border"
                      />
                      <span>Size Guide & Fit Modal</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={features.customerReviews}
                        onChange={(e) => setFeatures({ ...features, customerReviews: e.target.checked })}
                        className="rounded border-border"
                      />
                      <span>Customer Reviews & Instagram Social Proof Grid</span>
                    </label>
                  </div>
                </div>

                {/* Tech Stack */}
                <div className="pt-2 border-t border-border">
                  <Label className="text-xs">Frontend Framework / Tech Stack</Label>
                  <select
                    value={techStack}
                    onChange={(e) => setTechStack(e.target.value)}
                    className="w-full text-xs mt-1 bg-muted/60 border border-border rounded px-2.5 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="Next.js 15/16 App Router + Tailwind CSS + Lucide Icons">
                      Next.js 15/16 (App Router) + Tailwind CSS (Recommended)
                    </option>
                    <option value="React 19 + Vite + Tailwind CSS">React 19 + Vite + Tailwind CSS</option>
                    <option value="HTML5 + Tailwind CSS + Alpine.js">HTML5 + Tailwind CSS + Alpine.js</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Generated Master Prompt */}
          <div className="lg:col-span-7 space-y-3">
            <Card className="border-border">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-border">
                <div>
                  <CardTitle className="text-xs font-semibold">Generated Master AI Prompt</CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {masterPrompt.split('\n').length} lines · ~{Math.round(masterPrompt.length / 4)} tokens
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopy}
                    className="h-7 text-xs px-2.5 gap-1.5"
                  >
                    {copied ? (
                      <>
                        <span className="text-emerald-500 font-bold">✓</span>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copy Prompt</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative">
                  <pre className="p-4 text-[11px] font-mono leading-relaxed bg-muted/40 text-foreground overflow-x-auto max-h-[750px] overflow-y-auto whitespace-pre-wrap select-all">
                    {masterPrompt}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* AI Assistant Recommender */}
            <div className="rounded-lg border border-border bg-card p-3.5 text-xs text-muted-foreground space-y-2">
              <div className="font-medium text-foreground flex items-center gap-1.5">
                <span>💡 Where to use this prompt:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>
                  <strong className="text-foreground">Claude 3.7 Sonnet / ChatGPT 4o:</strong> Paste as the initial message to generate the full repository code, components, and layout.
                </li>
                <li>
                  <strong className="text-foreground">Cursor / Windsurf IDE:</strong> Save as <code>.cursorrules</code> or paste in composer to generate the complete Next.js app in your codebase.
                </li>
                <li>
                  <strong className="text-foreground">v0.dev / Bolt.new:</strong> Paste the prompt directly into the prompt box for an instant, interactive visual UI prototype.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STOREFRONT API REFERENCE */}
      {activeTab === 'api' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Storefront API Endpoints & Request/Response Contracts</CardTitle>
              <CardDescription className="text-xs">
                All 13 public storefront endpoints available for your custom front-end. Always supply <code>x-store-id: {activeStoreId}</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-border rounded-md">
                  <thead className="bg-muted/70 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="p-2.5 font-medium">Method</th>
                      <th className="p-2.5 font-medium">Endpoint</th>
                      <th className="p-2.5 font-medium">Required Headers</th>
                      <th className="p-2.5 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">GET</td>
                      <td className="p-2.5 font-mono text-[11px]">/v1/storefront/store</td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">x-store-id</td>
                      <td className="p-2.5 text-muted-foreground">Store public metadata: name, currency, official WhatsApp phone</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">GET</td>
                      <td className="p-2.5 font-mono text-[11px]">/v1/storefront/products</td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">x-store-id</td>
                      <td className="p-2.5 text-muted-foreground">List of all published products with active variants, pricing, and stock</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">GET</td>
                      <td className="p-2.5 font-mono text-[11px]">/v1/storefront/products/:slug</td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">x-store-id</td>
                      <td className="p-2.5 text-muted-foreground">Single product PDP details by unique handle slug</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">GET</td>
                      <td className="p-2.5 font-mono text-[11px]">/v1/storefront/collections</td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">x-store-id</td>
                      <td className="p-2.5 text-muted-foreground">All published collections / categories</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">GET</td>
                      <td className="p-2.5 font-mono text-[11px]">/v1/storefront/collections/:slug</td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">x-store-id</td>
                      <td className="p-2.5 text-muted-foreground">Single collection detail with mapped products</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">GET</td>
                      <td className="p-2.5 font-mono text-[11px]">/v1/storefront/cart</td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">x-store-id, x-cart-id</td>
                      <td className="p-2.5 text-muted-foreground">Fetch shopper&apos;s current cart and line items</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-blue-600 dark:text-blue-400 font-bold">POST</td>
                      <td className="p-2.5 font-mono text-[11px]">/v1/storefront/cart/items</td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">x-store-id, x-cart-id</td>
                      <td className="p-2.5 text-muted-foreground">Add variant to cart <code>&#123; variantId, quantity &#125;</code></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-amber-600 dark:text-amber-400 font-bold">PATCH</td>
                      <td className="p-2.5 font-mono text-[11px]">/v1/storefront/cart/items/:itemId</td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">x-store-id, x-cart-id</td>
                      <td className="p-2.5 text-muted-foreground">Update quantity of item in cart <code>&#123; quantity &#125;</code></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-red-600 dark:text-red-400 font-bold">DELETE</td>
                      <td className="p-2.5 font-mono text-[11px]">/v1/storefront/cart/items/:itemId</td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">x-store-id, x-cart-id</td>
                      <td className="p-2.5 text-muted-foreground">Remove item line from cart</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-blue-600 dark:text-blue-400 font-bold">POST</td>
                      <td className="p-2.5 font-mono text-[11px]">/v1/storefront/discounts/validate</td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">x-store-id</td>
                      <td className="p-2.5 text-muted-foreground">Validate coupon code against current subtotal</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-blue-600 dark:text-blue-400 font-bold">POST</td>
                      <td className="p-2.5 font-mono text-[11px]">/v1/storefront/orders/checkout</td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">x-store-id, x-cart-id</td>
                      <td className="p-2.5 text-muted-foreground">Atomic COD checkout. Returns order + one-time <code>accessToken</code></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">GET</td>
                      <td className="p-2.5 font-mono text-[11px]">/v1/storefront/orders/:id</td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">x-store-id, x-order-token</td>
                      <td className="p-2.5 text-muted-foreground">Private order confirmation and delivery status</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-blue-600 dark:text-blue-400 font-bold">POST</td>
                      <td className="p-2.5 font-mono text-[11px]">/v1/storefront/orders/:id/verify-whatsapp</td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">x-store-id, x-order-token</td>
                      <td className="p-2.5 text-muted-foreground">Logs order as WhatsApp verified to reduce courier delivery failure</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: PAKISTAN COD & CONVERSION GUIDE */}
      {activeTab === 'strategy' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Pakistani E-Commerce & COD Rules of Engagement</CardTitle>
              <CardDescription className="text-xs">
                Key patterns to achieve 15%+ conversion and minimize courier return-to-origin (RTO) rates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
              <div className="rounded border border-border p-2.5 bg-muted/30">
                <span className="font-semibold text-foreground block mb-0.5">1. Phone Number is the Primary ID</span>
                Pakistani consumers do not rely heavily on email. Always prioritize valid mobile numbers (<code>03001234567</code>). The API automatically normalizes phones to E.164 format (<code>+923001234567</code>).
              </div>
              <div className="rounded border border-border p-2.5 bg-muted/30">
                <span className="font-semibold text-foreground block mb-0.5">2. Eliminate Multi-Step Checkout</span>
                Never force shoppers to create passwords or register an account before purchasing. Our 1-page COD checkout lets them order in under 20 seconds.
              </div>
              <div className="rounded border border-border p-2.5 bg-muted/30">
                <span className="font-semibold text-foreground block mb-0.5">3. WhatsApp Verification Reduces RTO by 40%</span>
                Prompting shoppers with the WhatsApp Confirmation button immediately after checkout confirms their delivery address and stops impulse fake orders.
              </div>
              <div className="rounded border border-border p-2.5 bg-muted/30">
                <span className="font-semibold text-foreground block mb-0.5">4. Clear Shipping Timeline Badges</span>
                Clearly state expected delivery times (e.g. <em>&quot;Karachi: 1-2 Days | Other Cities: 2-4 Days via Trax/Leopards&quot;</em>). Reassurance builds immediate buying confidence.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Money & Currency Handling</CardTitle>
              <CardDescription className="text-xs">
                How POSflow handles Pakistani Rupees without float errors.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
              <p>
                In POSflow, currency is stored strictly in integer minor units (paisas) to prevent fractional cent/rupee rounding bugs.
              </p>
              <div className="rounded-md bg-muted p-3 font-mono text-[11px] text-foreground">
                <div>// Price received from API:</div>
                <div className="text-amber-600 dark:text-amber-400">variant.priceMinor = 245000;</div>
                <br />
                <div>// Correct Display Conversion:</div>
                <div className="text-emerald-600 dark:text-emerald-400">
                  const pkr = (variant.priceMinor / 100).toLocaleString(&apos;en-PK&apos;);
                </div>
                <div>// Result: &quot;Rs. 2,450&quot;</div>
              </div>
              <p>
                When sending coupons or validating subtotals, always submit <code>subtotalMinor</code> as an integer.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
