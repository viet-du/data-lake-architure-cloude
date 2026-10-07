import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Drawer,
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  Tag,
  SamplePreview,
  HistoryTimeline,
  ScreenLoading,
  ScreenError,
  Button,
  EmptyState,
} from '@/components';
import {
  useGoldTableQuery,
  useGoldTableSampleQuery,
  useGoldTableStatsQuery,
  useGoldTableHistoryQuery,
  useGoldTableLineageQuery,
  useRefreshGoldMutation,
} from '@/services/queries';
import { LineageGraph, type LineageData } from './lineage-graph.component';

export interface GoldTableDetailProps {
  table: string | null;
  onClose: () => void;
}

type DetailTab = 'overview' | 'sample' | 'history' | 'lineage' | 'stats';

function formatBytes(n: number): string {
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(2)} GB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${n} B`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
}

export function GoldTableDetail({ table, onClose }: GoldTableDetailProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DetailTab>('overview');

  const tableQuery = useGoldTableQuery(table ?? '');
  const sampleQuery = useGoldTableSampleQuery(table ?? '', 50);
  const statsQuery = useGoldTableStatsQuery(table ?? '');
  const historyQuery = useGoldTableHistoryQuery(table ?? '');
  const lineageQuery = useGoldTableLineageQuery(table ?? '');
  const refreshMutation = useRefreshGoldMutation();

  return (
    <Drawer
      open={table !== null}
      onClose={onClose}
      size="xl"
      title={table ?? ''}
      footer={
        table !== null ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => refreshMutation.mutate(table)}
            disabled={refreshMutation.isPending}
          >
            {t('screens.gold.refresh')}
          </Button>
        ) : null
      }
    >
      {tableQuery.isLoading ? (
        <ScreenLoading rows={3} />
      ) : tableQuery.isError ? (
        <ScreenError error={tableQuery.error} onRetry={() => void tableQuery.refetch()} compact />
      ) : tableQuery.data === undefined ? (
        <EmptyState compact title={t('common.error')} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tag size="sm" variant="warning">
              {tableQuery.data.aggregateType ?? 'group_by'}
            </Tag>
            <Tag size="sm" variant="neutral">
              {tableQuery.data.sourceLayer}
            </Tag>
            <Tag size="sm" variant={tableQuery.data.status === 'healthy' ? 'success' : 'warning'}>
              {tableQuery.data.status}
            </Tag>
            <span className="text-[10px] text-neutral-500">{tableQuery.data.database}</span>
          </div>

          <TabsRoot value={tab} onValueChange={(v) => setTab(v as DetailTab)}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="sample">Sample</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="lineage">Lineage</TabsTrigger>
              <TabsTrigger value="stats">Stats</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">Rows</p>
                  <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                    {formatNumber(tableQuery.data.rowCount)}
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">Size</p>
                  <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                    {formatBytes(tableQuery.data.sizeBytes)}
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">Source layer</p>
                  <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                    {tableQuery.data.sourceLayer}
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">Sources</p>
                  <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                    {tableQuery.data.sourceTables.length}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wider text-neutral-500">Source tables</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {tableQuery.data.sourceTables.map((s) => (
                    <Tag key={s} size="sm" variant="info">
                      {s}
                    </Tag>
                  ))}
                </div>
              </div>
              {tableQuery.data.refreshSchedule !== undefined ? (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">Schedule</p>
                  <p className="mt-1 font-mono text-xs text-neutral-300">
                    {tableQuery.data.refreshSchedule}
                  </p>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="sample">
              <SamplePreview
                columns={sampleQuery.data?.columns ?? []}
                rows={sampleQuery.data?.rows ?? []}
                isLoading={sampleQuery.isLoading}
                isError={sampleQuery.isError}
                error={sampleQuery.error}
                onRetry={() => void sampleQuery.refetch()}
                maxRows={30}
              />
            </TabsContent>

            <TabsContent value="history">
              <HistoryTimeline
                items={
                  (historyQuery.data ?? []).map((h) => ({
                    version: h.version,
                    timestamp: h.timestamp,
                    operation: h.operation,
                    recordsAffected: h.recordsAffected,
                    userName: h.userName,
                  }))
                }
                isLoading={historyQuery.isLoading}
                isError={historyQuery.isError}
                error={historyQuery.error}
                onRetry={() => void historyQuery.refetch()}
              />
            </TabsContent>

            <TabsContent value="lineage">
              <LineageGraph
                data={lineageQuery.data as LineageData | undefined}
                isLoading={lineageQuery.isLoading}
                isError={lineageQuery.isError}
                error={lineageQuery.error}
                onRetry={() => void lineageQuery.refetch()}
              />
            </TabsContent>

            <TabsContent value="stats">
              {statsQuery.isLoading ? (
                <ScreenLoading rows={3} />
              ) : statsQuery.isError ? (
                <ScreenError
                  error={statsQuery.error}
                  onRetry={() => void statsQuery.refetch()}
                  compact
                />
              ) : statsQuery.data === undefined ? null : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500">Files</p>
                    <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                      {statsQuery.data.fileCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500">Last status</p>
                    <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                      {statsQuery.data.lastRefreshStatus}
                    </p>
                  </div>
                  {statsQuery.data.refreshDurationMs !== undefined ? (
                    <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                        Refresh time
                      </p>
                      <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                        {formatDuration(statsQuery.data.refreshDurationMs)}
                      </p>
                    </div>
                  ) : null}
                  {statsQuery.data.consumerLagSeconds !== undefined ? (
                    <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                        Consumer lag
                      </p>
                      <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                        {statsQuery.data.consumerLagSeconds}s
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </TabsContent>
          </TabsRoot>
        </div>
      )}
    </Drawer>
  );
}