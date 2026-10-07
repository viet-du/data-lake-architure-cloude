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
  PartitionsList,
  ScreenLoading,
  ScreenError,
  EmptyState,
} from '@/components';
import {
  useBronzeTableQuery,
  useBronzeTableSampleQuery,
  useBronzeTableStatsQuery,
  useBronzeTableHistoryQuery,
  useBronzeTablePartitionsQuery,
  useBronzeDeletePartitionMutation,
} from '@/services/queries';

export interface BronzeTableDetailProps {
  table: string | null;
  onClose: () => void;
}

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

export function BronzeTableDetail({ table, onClose }: BronzeTableDetailProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'overview' | 'sample' | 'history' | 'partitions'>('overview');

  const tableQuery = useBronzeTableQuery(table ?? '');
  const sampleQuery = useBronzeTableSampleQuery(table ?? '', 50);
  const statsQuery = useBronzeTableStatsQuery(table ?? '');
  const historyQuery = useBronzeTableHistoryQuery(table ?? '');
  const partitionsQuery = useBronzeTablePartitionsQuery(table ?? '');
  const deletePartition = useBronzeDeletePartitionMutation();

  return (
    <Drawer
      open={table !== null}
      onClose={onClose}
      size="xl"
      title={table ?? ''}
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
            <Tag size="sm" variant="primary">
              {tableQuery.data.format}
            </Tag>
            <Tag size="sm" variant={tableQuery.data.status === 'healthy' ? 'success' : 'warning'}>
              {tableQuery.data.status}
            </Tag>
            <span className="text-[10px] text-neutral-500">{tableQuery.data.database}</span>
          </div>

          <TabsRoot value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="sample">Sample</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="partitions">Partitions</TabsTrigger>
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
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">Files</p>
                      <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                        {statsQuery.data.fileCount}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                        Partitions
                      </p>
                      <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                        {statsQuery.data.partitionCount}
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
              {tableQuery.data.partitionBy.length > 0 ? (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Partition by
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tableQuery.data.partitionBy.map((p) => (
                      <Tag key={p} size="sm" variant="info">
                        {p}
                      </Tag>
                    ))}
                  </div>
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
                    recordsAdded: h.recordsAdded,
                    recordsRemoved: h.recordsRemoved,
                    userName: h.userName,
                  }))
                }
                isLoading={historyQuery.isLoading}
                isError={historyQuery.isError}
                error={historyQuery.error}
                onRetry={() => void historyQuery.refetch()}
              />
            </TabsContent>

            <TabsContent value="partitions">
              <PartitionsList
                partitions={partitionsQuery.data ?? []}
                isLoading={partitionsQuery.isLoading}
                isError={partitionsQuery.isError}
                error={partitionsQuery.error}
                onRetry={() => void partitionsQuery.refetch()}
                onDelete={(p) => {
                  if (table !== null) deletePartition.mutate({ table, date: p });
                }}
                deletingKey={undefined}
              />
            </TabsContent>
          </TabsRoot>
        </div>
      )}
    </Drawer>
  );
}
