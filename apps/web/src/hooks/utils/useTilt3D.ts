import { useCallback, useEffect, useRef, useState } from 'react';

export interface TiltState {
  rotateX: number;
  rotateY: number;
  isHovering: boolean;
}

export function useTilt3D(maxAngleDeg: number = 12) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState({ rotateX: 0, rotateY: 0, isHovering: false });

  const handleMove = useCallback(
    (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setState({ rotateX: -y * 2 * maxAngleDeg, rotateY: x * 2 * maxAngleDeg, isHovering: true });
    },
    [maxAngleDeg],
  );

  const handleLeave = useCallback(() => {
    setState({ rotateX: 0, rotateY: 0, isHovering: false });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', handleLeave);
    return () => {
      el.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, [handleMove, handleLeave]);

  return { ref, state };
}
