import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/theme';
import { useTilt3D } from '@/hooks';

export interface Tilt3DCardProps extends HTMLAttributes<HTMLDivElement> {
  maxAngle?: number;
  perspective?: number;
  scale?: number;
  disabled?: boolean;
  children: ReactNode;
}

export function Tilt3DCard({
  maxAngle = 12,
  perspective = 1000,
  scale = 1.02,
  disabled = false,
  className,
  children,
  style,
  ...rest
}: Tilt3DCardProps) {
  const { ref, state } = useTilt3D(maxAngle);

  return (
    <div
      ref={disabled ? null : ref}
      className={cn('transition-transform duration-200 ease-out', className)}
      style={{
        transform: disabled
          ? 'none'
          : `perspective(${perspective}px) rotateX(${state.rotateX}deg) rotateY(${state.rotateY}deg) scale(${state.isHovering ? scale : 1})`,
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
