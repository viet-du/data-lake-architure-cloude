import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Modal, Tag } from '@/components';
import { NAV_ROUTES, ROUTES, type RoutePath } from '@/navigation/routes';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface PaletteItem {
  path: RoutePath;
  title: string;
  hint: string;
}

const PANEL_INITIAL = { opacity: 0, scale: 0.97, y: -8 };
const PANEL_ANIMATE = { opacity: 1, scale: 1, y: 0 };
const PANEL_EXIT = { opacity: 0, scale: 0.97, y: -8 };
const TRANSITION = { duration: 0.18, ease: 'easeOut' as const };

export const CommandPalette: FC<CommandPaletteProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState<string>('');
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const items: ReadonlyArray<PaletteItem> = useMemo(() => {
    return NAV_ROUTES.map((entry) => {
      const slug = entry.path.replace(/^\//, '');
      const key = `nav.${slug === '' ? 'home' : slug.replace(/-/g, '_')}`;
      return {
        path: entry.path,
        title: t(key, entry.path),
        hint: entry.path,
      } satisfies PaletteItem;
    });
  }, [t]);

  const filtered = useMemo<ReadonlyArray<PaletteItem>>(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return items;
    return items.filter(
      (item) => item.title.toLowerCase().includes(q) || item.path.toLowerCase().includes(q),
    );
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
    return;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (activeIdx >= filtered.length) setActiveIdx(0);
  }, [filtered, activeIdx, open]);

  const goTo = (path: RoutePath) => {
    onClose();
    navigate(path);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filtered[activeIdx];
      if (target !== undefined) goTo(target.path);
    }
  };

  return (
    <Modal open={open} onClose={onClose} closeOnBackdrop size="lg" className="!p-0">
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div key="palette" initial={PANEL_INITIAL} animate={PANEL_ANIMATE} exit={PANEL_EXIT} transition={TRANSITION}>
            <div className="border-b border-white/10 px-4 py-3">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder={t('palette.placeholder', 'Type a route or page…')}
                className="w-full bg-transparent text-base text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-50"
                aria-label="Command palette input"
                data-testid="command-palette-input"
              />
            </div>
            <ul
              className="max-h-80 overflow-y-auto py-2"
              role="listbox"
              aria-label="Command palette results"
            >
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
                  {t('palette.empty', 'No matches')}
                </li>
              ) : (
                filtered.map((item, idx) => (
                  <li key={item.path} role="option" aria-selected={idx === activeIdx}>
                    <button
                      type="button"
                      onClick={() => goTo(item.path)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors ${
                        idx === activeIdx
                          ? 'bg-primary-500/15 text-neutral-900 dark:text-neutral-50'
                          : 'text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <span className="truncate">{item.title}</span>
                      <Tag variant="default" size="sm">
                        {item.hint === ROUTES.HOME ? '/' : item.hint}
                      </Tag>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Modal>
  );
};

export default CommandPalette;