import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ErrorBoundary,
  ScreenPageHeader,
  PipelineFlow,
  StorageInspector,
  SchematicLegend,
} from '@/components';
import type { EPipelineNodeKind } from '@/components/schematic';

export function SchematicView() {
  const { t } = useTranslation();
  const [active, setActive] = useState<EPipelineNodeKind | null>(null);

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col gap-4">
        <ScreenPageHeader
          iconName="Cloud"
          titleKey="schematic.title"
          subtitleKey="schematic.subtitle"
          descriptionKey="schematic.description"
          accent="primary"
        />

        <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950">
          <ErrorBoundary>
            <PipelineFlow activeKind={active} onSelect={setActive} />
          </ErrorBoundary>

          <div className="pointer-events-none absolute inset-0 z-10">
            <div className="pointer-events-auto">
              <StorageInspector activeKind={active} onClose={() => setActive(null)} />
            </div>
            <div className="pointer-events-auto">
              <SchematicLegend activeKind={active} onSelect={setActive} />
            </div>
            <div className="pointer-events-auto absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] uppercase tracking-widest text-neutral-300 backdrop-blur-2xl">
              {t('schematic.hint')}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
