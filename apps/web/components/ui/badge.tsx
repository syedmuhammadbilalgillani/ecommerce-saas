import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground',
        secondary:
          'border-border bg-secondary/80 text-secondary-foreground',
        destructive:
          'border-rose-900/40 bg-rose-950/20 text-rose-300',
        outline: 'border-border text-muted-foreground',
        success: 'border-emerald-800/40 bg-emerald-950/20 text-emerald-300',
        warning: 'border-amber-800/40 bg-amber-950/20 text-amber-300',
        info: 'border-zinc-700/50 bg-zinc-800/40 text-zinc-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
