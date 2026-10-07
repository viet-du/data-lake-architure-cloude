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
  useKafkaTopicQuery,
  useKafkaMessagesQuery,
  useDeleteKafkaTopicMutation,
} from '@/services/queries';
import { useToast } from '@/hooks';
import { KafkaMessageList } from './kafka-message-list.component';
import { KafkaProduceForm } from './kafka-produce-form.component';
import type { EHealthStatus } from '@/types/commons';

export interface KafkaTopicDetailProps {
  name: string | null;
  onClose: () => void;
}

type DetailTab = 'overview' | 'messages' | 'config' | 'produce';

const HEALTH_VARIANT: Readonly<Record<EHealthStatus, 'success' | 'warning' | 'error'>> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'error',
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatRetention(ms: number): string {
  if (ms >= 86_400_000) return `${Math.round(ms / 86_400_000)}d`;
  if (ms >= 3_600_000) return `${Math.round(ms / 3_600_000)}h`;
  if (ms >= 60_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 1000)}s`;
}

export function KafkaTopicDetail({ name, onClose }: KafkaTopicDetailProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [tab, setTab] = useState<DetailTab>('overview');
  const [produceOpen, setProduceOpen] = useState(false);
  const [partition, setPartition] = useState<number | undefined>(undefined);

  const topicQuery = useKafkaTopicQuery(name ?? '');
  const messagesQuery = useKafkaMessagesQuery(
    name ?? '',
    partition !== undefined ? { partition, limit: 50 } : { limit: 50 },
  );
  const deleteMut = useDeleteKafkaTopicMutation();

  function handleDelete(): void {
    if (name === null) return;
    if (!confirm(t('kafka.confirmDelete', { name }))) return;
    deleteMut.mutate(name, {
      onSuccess: () => {
        toast.success(t('kafka.deleted'));
        onClose();
      },
      onError: (e) => toast.error(t('kafka.error.delete'), e.message),
    });
  }

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
              onClick={handleDelete}
              disabled={deleteMut.isPending}
            >
              {t('kafka.delete')}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setProduceOpen(true)}>
              {t('kafka.produce')}
            </Button>
          </div>
        ) : null
      }
    >
      {topicQuery.isLoading ? (
        <ScreenLoading rows={3} />
      ) : topicQuery.isError ? (
        <ScreenError error={topicQuery.error} onRetry={() => void topicQuery.refetch()} compact />
      ) : topicQuery.data === undefined ? (
        <EmptyState compact title={t('common.error')} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tag size="sm" variant={HEALTH_VARIANT[topicQuery.data.status]}>
              {topicQuery.data.status}
            </Tag>
            <Tag size="sm" variant="primary">
              {topicQuery.data.partitions} partitions
            </Tag>
            <Tag size="sm" variant="neutral">
              RF {topicQuery.data.replicationFactor}
            </Tag>
            <span className="text-[10px] text-neutral-500">
              {formatNumber(topicQuery.data.messagesPerSec)} msg/s ·{' '}
              {formatRetention(topicQuery.data.retentionMs)} retention
            </span>
          </div>

          <TabsRoot value={tab} onValueChange={(v) => setTab(v as DetailTab)}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Messages/s
                  </p>
                  <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                    {formatNumber(topicQuery.data.messagesPerSec)}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-amber-500">Lag</p>
                  <p className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400">
                    {formatNumber(topicQuery.data.lag)}
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Consumer groups
                  </p>
                  <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                    {topicQuery.data.consumerGroups}
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Created
                  </p>
                  <p className="mt-1 text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {new Date(topicQuery.data.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="messages">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Filter partition
                  </p>
                  {[undefined, ...Array.from({ length: topicQuery.data.partitions }, (_, i) => i)]
                    .slice(0, 9)
                    .map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPartition(p)}
                        className={`rounded-md border px-2 py-0.5 text-[10px] transition-colors ${
                          partition === p
                            ? 'border-primary-500/40 bg-primary-500/10 text-primary-600 dark:text-primary-300'
                            : 'border-white/10 bg-white/5 text-neutral-500 hover:bg-white/10'
                        }`}
                      >
                        {p === undefined ? 'all' : `p${p}`}
                      </button>
                    ))}
                </div>
                <KafkaMessageList
                  messages={messagesQuery.data}
                  isLoading={messagesQuery.isLoading}
                  isError={messagesQuery.isError}
                  error={messagesQuery.error}
                  onRetry={() => void messagesQuery.refetch()}
                  maxRows={50}
                />
              </div>
            </TabsContent>

            <TabsContent value="config">
              {topicQuery.data.config === undefined ||
              Object.keys(topicQuery.data.config).length === 0 ? (
                <EmptyState compact title={t('kafka.noConfig')} />
              ) : (
                <div className="overflow-hidden rounded-lg border border-white/10">
                  <table className="w-full text-xs">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                          Key
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(topicQuery.data.config).map(([k, v]) => (
                        <tr key={k} className="border-t border-white/5">
                          <td className="px-3 py-1.5 font-mono text-neutral-300">{k}</td>
                          <td className="px-3 py-1.5 font-mono text-neutral-700 dark:text-neutral-300">
                            {v}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </TabsRoot>
        </div>
      )}
      {name !== null ? (
        <KafkaProduceForm
          open={produceOpen}
          topic={name}
          onClose={() => setProduceOpen(false)}
        />
      ) : null}
    </Drawer>
  );
}