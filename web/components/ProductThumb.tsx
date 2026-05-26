'use client';

import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  src: string | null;
  alt?: string;
  className?: string;
  iconSize?: number;
}

// Thumbnail con fallback a icono cuando la URL del super está rota / 403.
// Vive del lado cliente porque necesita onError para detectar fallos de carga.
export function ProductThumb({ src, alt = '', className, iconSize = 20 }: Props) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-paper-dim',
          className
        )}
      >
        <ImageOff size={iconSize} strokeWidth={1.5} className="text-ink-faint" />
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn('h-full w-full object-contain', className)}
      onError={() => setBroken(true)}
    />
  );
}
