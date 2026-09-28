'use client';

import React, { useEffect, useRef, useState } from 'react';
import { errorMessage, getUploadConfig, uploadImageFile } from '@/lib/api';
import { Button } from '@repo/ui';

/**
 * Drop-in "upload from computer" button for any place that collects image URLs.
 * Renders nothing unless the platform admin has enabled Cloudinary for this tenant,
 * so the URL field next to it keeps working as the fallback.
 */
export function ImageUploadButton({
  onUploaded,
  onError,
  multiple = true,
  label = 'Upload images',
  className = 'h-7 text-[11px] px-2 font-normal',
}: {
  onUploaded: (urls: string[]) => void;
  onError?: (message: string) => void;
  multiple?: boolean;
  label?: string;
  className?: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getUploadConfig()
      .then((c) => !cancelled && setEnabled(c.enabled))
      .catch(() => !cancelled && setEnabled(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) urls.push(await uploadImageFile(file));
      onUploaded(urls);
    } catch (err) {
      onError?.(`Upload failed: ${errorMessage(err)}`);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => input.current?.click()} className={className}>
        {uploading ? 'Uploading...' : label}
      </Button>
    </>
  );
}
