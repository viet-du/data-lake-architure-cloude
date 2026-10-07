import { useCallback, useState } from 'react';

export interface PanZoomState {
  scale: number;
  x: number;
  y: number;
}

export function useSvgPanZoom(initialScale: number = 1) {
  const [state, setState] = useState<PanZoomState>({ scale: initialScale, x: 0, y: 0 });

  const zoomIn = useCallback(() => {
    setState((s) => ({ ...s, scale: Math.min(s.scale * 1.2, 5) }));
  }, []);

  const zoomOut = useCallback(() => {
    setState((s) => ({ ...s, scale: Math.max(s.scale / 1.2, 0.2) }));
  }, []);

  const reset = useCallback(() => {
    setState({ scale: initialScale, x: 0, y: 0 });
  }, [initialScale]);

  const pan = useCallback((dx: number, dy: number) => {
    setState((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
  }, []);

  return { state, zoomIn, zoomOut, reset, pan };
}
