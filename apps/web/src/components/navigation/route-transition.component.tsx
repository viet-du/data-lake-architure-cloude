import { type ReactNode, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useDocumentMeta, useViewTransition } from '@/hooks';
import { ROUTE_META } from '@/config';

export interface RouteTransitionProps {
  children: ReactNode;
  className?: string;
}

const INITIAL = { opacity: 0, y: 8 };
const ANIMATE = { opacity: 1, y: 0 };
const EXIT = { opacity: 0, y: -8 };
const TRANSITION = { duration: 0.22, ease: 'easeOut' as const };

export function RouteTransition({ children, className }: RouteTransitionProps) {
  const location = useLocation();
  const { supported, reducedMotion, desktop } = useViewTransition();
  const meta = ROUTE_META[location.pathname as keyof typeof ROUTE_META] ?? ROUTE_META['/'];
  useDocumentMeta({
    title: meta.title,
    description: meta.description,
    keywords: 'keywords' in meta ? meta.keywords : undefined,
    ogTitle: meta.title,
    ogDescription: meta.description,
    ogType: 'website',
  });

  const useNativeTransition = supported && !reducedMotion && desktop;
  const [viewTransitionName] = useState<string>(() => 'lakehouse-page');

  useEffect(() => {
    if (useNativeTransition) {
      document.documentElement.style.setProperty(
        '--route-vt-name',
        viewTransitionName,
      );
    }
    return () => {
      if (useNativeTransition) {
        document.documentElement.style.removeProperty('--route-vt-name');
      }
    };
  }, [useNativeTransition, viewTransitionName]);

  if (useNativeTransition) {
    return (
      <div
        data-vt-route
        style={{ viewTransitionName }}
        className={className}
      >
        {children}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={INITIAL}
        animate={ANIMATE}
        exit={EXIT}
        transition={TRANSITION}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
