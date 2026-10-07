import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useKafkaTopicsQuery,
  useKafkaConsumerGroupsQuery,
  useKafkaStatsQuery,
  useKafkaClusterQuery,
} from '@/services/queries';
import {
  Button,
  EmptyState,
  ErrorBoundary,
  ScreenPageHeader,
  ScreenSection,
  ScreenLoading,
  ScreenError,
  SearchInput,
  Tag,
  KafkaTopicCard,
  KafkaTopicDetail,
  KafkaConsumerGroupTable,
  KafkaProduceForm,
  type ETagVariant,
} from '@/components';
import { cn } from '@/theme';
import type { EHealthStatus } from '@/types/commons';

const HEALTH_VARIANT: Readonly<Record<EHealthStatus, ETagVariant>> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'error',
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function StatsBar() {
  const statsQuery = useKafkaStatsQuery();
  const clusterQuery = useKafkaClusterQuery();
  const stats = statsQuery.data;
  const cluster = clusterQuery.data;
  if (statsQuery.isLoading || stats === null || stats === undefined) {
    return <ScreenLoading rows={1} />;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">Topics</p>
        <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
          {stats.topics}
        </p>
      </div>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-amber-500">Consumer groups</p>
        <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">
          {stats.consumerGroups}
        </p>
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-emerald-500">Messages/s</p>
        <p className="mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400">
          {formatNumber(stats.totalMessagesPerSec)}
        </p>
      </div>
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-red-500">Total lag</p>
        <p className="mt-1 text-base font-bold text-red-600 dark:text-red-400">
          {formatNumber(stats.totalLag)}
        </p>
      </div>
      {cluster !== null && cluster !== undefined ? (
        <div className="col-span-2 flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-3 sm:col-span-4">
          <Tag size="sm" variant={HEALTH_VARIANT['healthy']}>
            {cluster.brokerCount} brokers
          </Tag>
          <span className="font-mono text-[10px] text-neutral-500">{cluster.clusterId}</span>
          <span className="text-[10px] text-neutral-500">v{cluster.version}</span>
          <span className="text-[10px] text-neutral-500">
            ctrl #{cluster.controllerId}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function TopicsList({
  search,
  onSelect,
  onProduce,
}: {
  search: string;
  onSelect: (n: string) => void;
  onProduce: (n: string) => void;
}) {
  const topicsQuery = useKafkaTopicsQuery();
  if (topicsQuery.isLoading) return <ScreenLoading rows={6} variant="grid" />;
  if (topicsQuery.isError) {
    return <ScreenError error={topicsQuery.error} onRetry={() => void topicsQuery.refetch()} compact />;
  }
  const items = topicsQuery.data ?? [];
  const filtered = search === '' ? items : items.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  if (filtered.length === 0) {
    return <EmptyState compact title="No topics" />;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filtered.map((t) => (
        <KafkaTopicCard
          key={t.name}
          topic={t}
          onClick={() => onSelect(t.name)}
          onProduce={() => onProduce(t.name)}
        />
      ))}
    </div>
  );
}

function ConsumerGroupsSection() {
  const groupsQuery = useKafkaConsumerGroupsQuery();
  return (
    <div className="flex flex-col gap-2">
      <KafkaConsumerGroupTable
        groups={groupsQuery.data}
        isLoading={groupsQuery.isLoading}
        isError={groupsQuery.isError}
        error={groupsQuery.error}
        onRetry={() => void groupsQuery.refetch()}
      />
    </div>
  );
}

export function KafkaView() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'topics' | 'groups'>('topics');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [produceFor, setProduceFor] = useState<string | null>(null);

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col gap-4">
        <ScreenPageHeader
          iconName="Kafka"
          titleKey="screens.kafka.title"
          subtitleKey="screens.kafka.subtitle"
          descriptionKey="screens.kafka.description"
          accent="kafka"
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setProduceFor(selected ?? '')}
              disabled={selected === null}
            >
              {t('screens.kafka.produce')}
            </Button>
          }
        />
        <StatsBar />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/5 p-1">
            {(['topics', 'groups'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === k
                    ? 'bg-primary-500/20 text-primary-600 dark:text-primary-300'
                    : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-900 dark:hover:text-neutral-100',
                )}
              >
                {t(`screens.kafka.${k}`)}
              </button>
            ))}
          </div>
          {tab === 'topics' ? (
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('screens.kafka.search')}
              className="w-72"
            />
          ) : null}
        </div>
        <div className="flex-1 overflow-hidden">
          {tab === 'topics' ? (
            <ScreenSection title={t('screens.kafka.topics')} padded={false}>
              <div className="p-4">
                <TopicsList
                  search={search}
                  onSelect={setSelected}
                  onProduce={setProduceFor}
                />
              </div>
            </ScreenSection>
          ) : (
            <ScreenSection title={t('screens.kafka.groups')} padded={false}>
              <div className="p-4">
                <ConsumerGroupsSection />
              </div>
            </ScreenSection>
          )}
        </div>
        <KafkaTopicDetail name={selected} onClose={() => setSelected(null)} />
        {produceFor !== null ? (
          <KafkaProduceForm
            open={produceFor !== null}
            topic={produceFor}
            onClose={() => setProduceFor(null)}
          />
        ) : null}
      </div>
    </ErrorBoundary>
  );
}
