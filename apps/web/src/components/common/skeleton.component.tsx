import { type HTMLAttributes } from 'react';
import { cn } from '@/theme';

export type ESkeletonShape = 'rect' | 'circle' | 'text';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  shape?: ESkeletonShape;
  width?: string | number;
  height?: string | number;
}

const SHAPE_CLASSES: Readonly<Record<ESkeletonShape, string>> = {
  rect: 'rounded-lg',
  circle: 'rounded-full',
  text: 'rounded-md h-3 w-full',
};

export function Skeleton({
  shape = 'rect',
  width,
  height,
  className,
  style,
  ...rest
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-white/5 dark:bg-white/5',
        'before:absolute before:inset-0',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        'before:animate-shimmer',
        SHAPE_CLASSES[shape],
        className,
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      {...rest}
    />
  );
}
