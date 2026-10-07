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
  Field,
  NumberField,
} from '@/components';
import {
  useSilverTableQuery,
  useSilverTableSampleQuery,
  useSilverTableStatsQuery,
  useSilverTableHistoryQuery,
  useSilverTimeTravelQuery,
  useSilverTableDiffQuery,
  useRefreshSilverMutation,
} from '@/services/queries';

export interface SilverTableDetailProps {
  table: string | null;
  onClose: () => void;
}

type DetailTab = 'overview' | 'sample' | 'history' | 'timetravel' | 'diff';

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

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

export function SilverTableDetail({ table, onClose }: SilverTableDetailProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DetailTab>('overview');
  const [ttVersion, setTtVersion] = useState<number | ''>('');
  const [v1, setV1] = useState<number | ''>('');
  const [v2, setV2] = useState<number | ''>('');

  const tableQuery = useSilverTableQuery(table ?? '');
  const sampleQuery = useSilverTableSampleQuery(table ?? '', 50);
  const statsQuery = useSilverTableStatsQuery(table ?? '');
  const historyQuery = useSilverTableHistoryQuery(table ?? '');
  const refreshMutation = useRefreshSilverMutation();
  const ttQuery = useSilverTimeTravelQuery(
    table ?? '',
    typeof ttVersion === 'number' ? String(ttVersion) : '',
  );
  const diffQuery = useSilverTableDiffQuery(
    table ?? '',
    typeof v1 === 'number' ? String(v1) : '',
    typeof v2 === 'number' ? String(v2) : '',
  );

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
            {t('screens.silver.refresh')}
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
            <Tag size="sm" variant="info">
              {tableQuery.data.format}
            </Tag>
            <Tag size="sm" variant={tableQuery.data.status === 'healthy' ? 'success' : 'warning'}>
              {tableQuery.data.status}
            </Tag>
            <span className="text-[10px] text-neutral-500">{tableQuery.data.database}</span>
            {tableQuery.data.sourceTable !== undefined ? (
              <Tag size="sm" variant="neutral">
                {tableQuery.data.sourceTable}
              </Tag>
            ) : null}
          </div>

          <TabsRoot value={tab} onValueChange={(v) => setTab(v as DetailTab)}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="sample">Sample</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="timetravel">Time travel</TabsTrigger>
              <TabsTrigger value="diff">Diff</TabsTrigger>
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
                {statsQuery.data !== undefined ? (
                  <>
                    <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">Dedup</p>
                      <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                        {formatPercent(statsQuery.data.dedupRate)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">Nulls</p>
                      <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                        {formatPercent(statsQuery.data.nullRate)}
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
              {tableQuery.data.transformRule !== undefined ? (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Transform rule
                  </p>
                  <pre className="mt-1 overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-2 text-[11px] text-neutral-300">
                    {tableQuery.data.transformRule}
                  </pre>
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

            <TabsContent value="timetravel">
              <div className="flex flex-col gap-3">
                <Field label="Version">
                  <NumberField
                    value={ttVersion}
                    onChange={setTtVersion}
                    min={0}
                    placeholder="e.g. 3"
                  />
                </Field>
                {typeof ttVersion === 'number' ? (
                  ttQuery.isLoading ? (
                    <ScreenLoading rows={3} />
                  ) : ttQuery.isError ? (
                    <ScreenError error={ttQuery.error} onRetry={() => void ttQuery.refetch()} compact />
                  ) : ttQuery.data === undefined ? null : (
                    <SamplePreview
                      columns={Object.keys(ttQuery.data.data[0] ?? {})}
                      rows={ttQuery.data.data}
                      isLoading={false}
                      isError={false}
                    />
                  )
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="diff">
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Version 1">
                    <NumberField value={v1} onChange={setV1} min={0} placeholder="e.g. 1" />
                  </Field>
                  <Field label="Version 2">
                    <NumberField value={v2} onChange={setV2} min={0} placeholder="e.g. 2" />
                  </Field>
                </div>
                {typeof v1 === 'number' && typeof v2 === 'number' ? (
                  diffQuery.isLoading ? (
                    <ScreenLoading rows={3} />
                  ) : diffQuery.isError ? (
                    <ScreenError error={diffQuery.error} onRetry={() => void diffQuery.refetch()} compact />
                  ) : diffQuery.data === undefined ? null : (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-emerald-500">Added</p>
                        <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {formatNumber(diffQuery.data.addedRows)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-red-500">Removed</p>
                        <p className="mt-1 text-lg font-bold text-red-600 dark:text-red-400">
                          {formatNumber(diffQuery.data.removedRows)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-amber-500">Changed</p>
                        <p className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400">
                          {formatNumber(diffQuery.data.changedRows)}
                        </p>
                      </div>
                    </div>
                  )
                ) : null}
              </div>
            </TabsContent>
          </TabsRoot>
        </div>
      )}
    </Drawer>
  );
}
