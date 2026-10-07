import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Drawer,
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  Tag,
  ScreenLoading,
  ScreenError,
  Button,
  EmptyState,
} from '@/components';
import {
  useCrawlerJobQuery,
  useCrawlerJobConfigQuery,
  useCrawlerJobKafkaTopicQuery,
  useCrawlerJobPreviewQuery,
  useCrawlerJobRunsQuery,
  useCrawlerJobRunItemsQuery,
  useRunCrawlerMutation,
  useStopCrawlerMutation,
} from '@/services/queries';
import { CrawlerRunHistory } from './crawler-run-history.component';
import { CrawlerPreviewList } from './crawler-preview-list.component';
import type { ECrawlerStatus } from '@/types/entities';

export interface CrawlerJobDetailProps {
  name: string | null;
  onClose: () => void;
}

type DetailTab = 'overview' | 'config' | 'preview' | 'runs' | 'kafka';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

const STATUS_VARIANT: Readonly<Record<ECrawlerStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'>> = {
  running: 'info',
  paused: 'warning',
  idle: 'neutral',
  completed: 'success',
  failed: 'error',
};

export function CrawlerJobDetail({ name, onClose }: CrawlerJobDetailProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DetailTab>('overview');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const jobQuery = useCrawlerJobQuery(name ?? '');
  const configQuery = useCrawlerJobConfigQuery(name ?? '');
  const previewQuery = useCrawlerJobPreviewQuery(name ?? '', 30);
  const runsQuery = useCrawlerJobRunsQuery(name ?? '', { limit: 20 });
  const runItemsQuery = useCrawlerJobRunItemsQuery(name ?? '', selectedRunId ?? '', 30);
  const kafkaQuery = useCrawlerJobKafkaTopicQuery(name ?? '');
  const runMutation = useRunCrawlerMutation();
  const stopMutation = useStopCrawlerMutation();

  return (
    <Drawer
      open={name !== null}
      onClose={onClose}
      size="xl"
      title={name ?? ''}
      footer={
        name !== null ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => stopMutation.mutate(name)}
              disabled={stopMutation.isPending || jobQuery.data?.status !== 'running'}
            >
              {t('crawler.stop')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => runMutation.mutate({ name, payload: {} })}
              disabled={runMutation.isPending}
            >
              {runMutation.isPending ? t('crawler.running') : t('crawler.run')}
            </Button>
          </div>
        ) : null
      }
    >
      {jobQuery.isLoading ? (
        <ScreenLoading rows={3} />
      ) : jobQuery.isError ? (
        <ScreenError error={jobQuery.error} onRetry={() => void jobQuery.refetch()} compact />
      ) : jobQuery.data === undefined ? (
        <EmptyState compact title={t('common.error')} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tag size="sm" variant={STATUS_VARIANT[jobQuery.data.status]}>
              {jobQuery.data.status}
            </Tag>
            <Tag size="sm" variant="primary">
              {jobQuery.data.source}
            </Tag>
            <Tag size="sm" variant="neutral">
              {jobQuery.data.category}
            </Tag>
            <span className="text-[10px] text-neutral-500">
              {jobQuery.data.ratePerMinute} req/min · {jobQuery.data.maxWorkers} workers
            </span>
          </div>

          <TabsRoot value={tab} onValueChange={(v) => setTab(v as DetailTab)}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="runs">Runs</TabsTrigger>
              <TabsTrigger value="kafka">Kafka</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">Pages</p>
                  <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                    {formatNumber(jobQuery.data.pagesScraped)}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-500">Collected</p>
                  <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatNumber(jobQuery.data.recordsCollected)}
                  </p>
                </div>
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-red-500">Failed</p>
                  <p className="mt-1 text-lg font-bold text-red-600 dark:text-red-400">
                    {formatNumber(jobQuery.data.recordsFailed)}
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">Started</p>
                  <p className="mt-1 text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {new Date(jobQuery.data.startedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="config">
              {configQuery.isLoading ? (
                <ScreenLoading rows={3} />
              ) : configQuery.isError ? (
                <ScreenError
                  error={configQuery.error}
                  onRetry={() => void configQuery.refetch()}
                  compact
                />
              ) : configQuery.data === undefined ? null : (
                <div className="flex flex-col gap-2 text-xs">
                  <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500">Base URL</p>
                    <p className="mt-1 font-mono text-xs text-neutral-300 break-all">
                      {configQuery.data.baseUrl}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">Rate</p>
                      <p className="mt-1 text-base font-bold text-neutral-900 dark:text-neutral-50">
                        {configQuery.data.ratePerMinute}/min
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">Workers</p>
                      <p className="mt-1 text-base font-bold text-neutral-900 dark:text-neutral-50">
                        {configQuery.data.maxWorkers}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">Timeout</p>
                      <p className="mt-1 text-base font-bold text-neutral-900 dark:text-neutral-50">
                        {formatDuration(configQuery.data.timeoutSec * 1000)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">Retries</p>
                      <p className="mt-1 text-base font-bold text-neutral-900 dark:text-neutral-50">
                        {configQuery.data.retries}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="preview">
              <CrawlerPreviewList
                items={previewQuery.data}
                isLoading={previewQuery.isLoading}
                isError={previewQuery.isError}
                error={previewQuery.error}
                onRetry={() => void previewQuery.refetch()}
                maxRows={15}
              />
            </TabsContent>

            <TabsContent value="runs">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-neutral-500">
                    Recent runs
                  </p>
                  <CrawlerRunHistory
                    runs={runsQuery.data}
                    isLoading={runsQuery.isLoading}
                    isError={runsQuery.isError}
                    error={runsQuery.error}
                    onRetry={() => void runsQuery.refetch()}
                    onSelect={setSelectedRunId}
                    selectedRunId={selectedRunId ?? undefined}
                  />
                </div>
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-neutral-500">
                    Items
                  </p>
                  {selectedRunId === null ? (
                    <EmptyState compact title={t('crawler.selectRun')} />
                  ) : (
                    <div className="flex flex-col gap-1">
                      {runItemsQuery.isLoading ? (
                        <ScreenLoading rows={3} />
                      ) : runItemsQuery.isError ? (
                        <ScreenError
                          error={runItemsQuery.error}
                          onRetry={() => void runItemsQuery.refetch()}
                          compact
                        />
                      ) : (
                        (runItemsQuery.data ?? []).slice(0, 30).map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded-md border border-white/5 bg-white/5 p-2"
                          >
                            <p className="max-w-[300px] truncate font-mono text-[10px] text-neutral-400">
                              {it.url}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-neutral-500">
                                {it.attempts}× · {formatDuration(it.durationMs)}
                              </span>
                              <Tag
                                size="sm"
                                variant={
                                  it.status === 'success'
                                    ? 'success'
                                    : it.status === 'failed'
                                      ? 'error'
                                      : 'warning'
                                }
                              >
                                {it.status}
                              </Tag>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="kafka">
              {kafkaQuery.isLoading ? (
                <ScreenLoading rows={2} />
              ) : kafkaQuery.isError ? (
                <ScreenError
                  error={kafkaQuery.error}
                  onRetry={() => void kafkaQuery.refetch()}
                  compact
                />
              ) : kafkaQuery.data === undefined ? null : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Tag size="sm" variant={kafkaQuery.data.enabled ? 'success' : 'neutral'}>
                      {kafkaQuery.data.enabled ? 'enabled' : 'disabled'}
                    </Tag>
                    <p className="font-mono text-xs text-neutral-300">
                      {kafkaQuery.data.topic}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500">Messages</p>
                    <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                      {formatNumber(kafkaQuery.data.messageCount)}
                    </p>
                    {kafkaQuery.data.lastProducedAt !== undefined ? (
                      <p className="text-[10px] text-neutral-500">
                        Last: {new Date(kafkaQuery.data.lastProducedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </TabsContent>
          </TabsRoot>
        </div>
      )}
    </Drawer>
  );
}