import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

// Empty state minimal: ícono lineal sutil + título + descripción + acción opcional.
// Sin "ilustración hecha en Figma" que satura el espacio.
export function EmptyState({ title, description, icon: Icon, action, className }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center py-16 px-6',
        className
      )}
    >
      {Icon && (
        <div className="mb-5 inline-flex items-center justify-center h-12 w-12 rounded-full bg-paper-dim text-ink-soft">
          <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
        </div>
      )}
      <h3 className="text-lg font-medium text-ink">{title}</h3>
      {description && (
        <p className="mt-2 max-w-prose text-sm text-ink-soft leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
