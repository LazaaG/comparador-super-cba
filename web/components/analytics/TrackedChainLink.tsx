'use client';

import { track } from '@/lib/analytics';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  href: string;
  chain: string;
  chainName: string;
  ean: string;
  page: 'producto' | 'comparar';
  className?: string;
  children?: React.ReactNode;
}

/**
 * Link al sitio del super que emite `chain_link_clicked` antes de navegar.
 * Mantiene `target="_blank"` + `rel="noopener noreferrer"`.
 */
export function TrackedChainLink({
  href,
  chain,
  chainName,
  ean,
  page,
  className,
  children
}: Props) {
  const handleClick = () => {
    track('chain_link_clicked', { chain, ean, page });
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-terra-deep',
        className
      )}
    >
      {children ?? <span>Ver en {chainName}</span>}
      <ExternalLink size={11} strokeWidth={1.75} aria-hidden="true" />
    </a>
  );
}
