import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ErrorBoundary,
  ScreenPageHeader,
  PipelineFlow,
  StorageInspector,
  SchematicLegend,
  overlayForNode,
  pipelineQuality,
  type EPipelineNodeKind,
  type SchematicOverlay,
} from '@/components';
import { useDashboardSummaryQuery } from '@/services/queries';
import { useDashboardStore } from '@/store';

export function SchematicView() {
  const { t } = useTranslation();
  const [active, setActive] = useState<EPipelineNodeKind | null>(null);

  // The overlay is a projection of the Home read model — the same request
  // that feeds the KPI cards. One source, so the schematic and the cards
  // can never disagree.
  //
  // The quality window comes from the shared store, so the badge below
  // always describes the same population as the Home card.
  const qualityWindow = useDashboardStore((state) => state.qualityWindow);
  const summaryQuery = useDashboardSummaryQuery({ window: qualityWindow });
  const stageStates = summaryQuery.data?.stageStates ?? [];
  const unavailable =
    summaryQuery.isError || (summaryQuery.data !== undefined && summaryQuery.data.stageStates.length === 0);

  const overlays = useMemo(() => {
    const map = new Map<EPipelineNodeKind, SchematicOverlay>();
    for (const kind of [
      'crawler',
      'bronze',
      'silver',
      'gold',
      'catalog',
      'storage',
    ] as const) {
      map.set(kind, overlayForNode(kind, stageStates, unavailable));
    }
    return map;
  }, [stageStates, unavailable]);

  const quality = pipelineQuality(stageStates);

  return (
    <ErrorBoundary>
      <div className="flex min-h-[850px] flex-col gap-4">
        <ScreenPageHeader
          iconName="Cloud"
          titleKey="schematic.title"
          subtitleKey="schematic.subtitle"
          descriptionKey="schematic.description"
          accent="primary"
        />

        <div className="relative h-[650px] min-h-[650px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950">
          <ErrorBoundary>
            <PipelineFlow activeKind={active} onSelect={setActive} overlays={overlays} />
          </ErrorBoundary>

          <div className="pointer-events-none absolute inset-0 z-10">
            <div className="pointer-events-auto">
              <StorageInspector
                activeKind={active}
                onClose={() => setActive(null)}
                overlay={active === null ? null : (overlays.get(active) ?? null)}
              />
            </div>
            <div className="pointer-events-auto">
              <SchematicLegend activeKind={active} onSelect={setActive} />
            </div>
            <div className="pointer-events-auto absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] uppercase tracking-widest text-neutral-300 backdrop-blur-2xl">
              {t('schematic.hint')}
            </div>
            <div className="pointer-events-auto absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] text-neutral-300 backdrop-blur-2xl">
              {summaryQuery.isError ? (
                <span>{t('schematic.overlay.unavailable')}</span>
              ) : quality === null ? (
                <span>{t('schematic.overlay.quality_not_evaluated')}</span>
              ) : (
                <span>
                  {t('schematic.overlay.quality_pass_rate', { rate: quality })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
