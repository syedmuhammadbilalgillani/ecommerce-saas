'use client';

import React, { useState, useEffect } from 'react';
import { getCollections, createCollection, type StoreCollection } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function MerchantCollectionsPage() {
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingCollection, setIsAddingCollection] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [collectionType, setCollectionType] = useState('manual');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getCollections();
      setCollections(Array.isArray(data) ? data : []);
      setLoading(false);
    }
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const payload = {
      title,
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      description,
      collectionType,
    };

    const newCol = await createCollection(payload);
    if (newCol) {
      setCollections(prev => [newCol, ...prev]);
    } else {
      setCollections(prev => [{ id: `col_${Date.now()}`, ...payload }, ...prev]);
    }

    setIsAddingCollection(false);
    setTitle('');
    setSlug('');
    setDescription('');
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-normal tracking-tight text-foreground">Collections</h1>
          <p className="text-xs text-muted-foreground font-normal">
            Group products into storefront collections (Manual drops, seasonal sales, brand catalogs).
          </p>
        </div>
        <Button
          onClick={() => setIsAddingCollection(!isAddingCollection)}
          className="text-xs font-normal h-8"
        >
          {isAddingCollection ? 'Cancel' : '+ Create Collection'}
        </Button>
      </div>

      {/* Create Collection Drawer */}
      {isAddingCollection && (
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-foreground">New Merchandising Collection</h2>
            <p className="text-xs text-muted-foreground">Configure a collection to surface on your storefront navigation and home grids.</p>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="colTitle">Collection Title</Label>
                <Input
                  id="colTitle"
                  placeholder="e.g. Eid Drop 2026"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                  }}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="colSlug">Slug (Storefront URL)</Label>
                <Input
                  id="colSlug"
                  placeholder="eid-drop-2026"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="colType">Collection Type</Label>
                <select
                  id="colType"
                  value={collectionType}
                  onChange={(e) => setCollectionType(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-border bg-card px-3 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="manual">Manual (Curate products manually)</option>
                  <option value="smart">Smart / Automated (Rule-based tag or price)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="colDesc">Description</Label>
              <Input
                id="colDesc"
                placeholder="Featured curation for festive season..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddingCollection(false)}
                className="text-xs font-normal"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="text-xs font-normal">
                Save Collection
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Collections List */}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Collection</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs">
                  Loading collections...
                </TableCell>
              </TableRow>
            ) : collections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs">
                  No collections created yet.
                </TableCell>
              </TableRow>
            ) : (
              collections.map((col) => (
                <TableRow key={col.id}>
                  <TableCell>
                    <div className="text-xs font-normal text-foreground">{col.title}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">/collections/{col.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {col.collectionType || 'manual'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-sm truncate">
                    {col.description || 'No description'}
                  </TableCell>
                  <TableCell className="text-right">
                    <a
                      href={`http://localhost:3000/collections/${col.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-secondary border border-border transition-colors"
                    >
                      View on Storefront ↗
                    </a>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
