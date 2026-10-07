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
import { useDQRuleQuery, useDQRunsQuery, useRunDQRuleMutation, useUpdateDQRuleMutation } from '@/services/queries';
import { useToast } from '@/hooks';
import { DQRunList } from './dq-run-list.component';
import type { DQRule, EDQSeverity, EDQStatus } from '@/types/entities';

export interface DQRuleDetailProps {
  ruleId: string | null;
  onClose: () => void;
}

type DetailTab = 'overview' | 'expression' | 'runs';

const STATUS_VARIANT: Readonly<Record<EDQStatus, 'success' | 'error' | 'warning'>> = {
  pass: 'success',
  fail: 'error',
  warning: 'warning',
};

const SEVERITY_VARIANT: Readonly<Record<EDQSeverity, 'neutral' | 'info' | 'warning' | 'error'>> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'error',
};

function formatTime(s: string | undefined): string {
  if (s === undefined) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

export function DQRuleDetail({ ruleId, onClose }: DQRuleDetailProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [tab, setTab] = useState<DetailTab>('overview');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const ruleQuery = useDQRuleQuery(ruleId ?? '');
  const runsQuery = useDQRunsQuery(ruleId !== null ? { ruleId, limit: 20 } : {});
  const runMut = useRunDQRuleMutation();
  const updateMut = useUpdateDQRuleMutation();

  function handleRun(): void {
    if (ruleId === null) return;
    runMut.mutate(ruleId, {
      onSuccess: () => toast.success(t('dq.runStarted')),
      onError: (e) => toast.error(t('dq.error.run'), e.message),
    });
  }

  function handleToggle(rule: DQRule | undefined): void {
    if (ruleId === null || rule === undefined) return;
    updateMut.mutate(
      { ruleId, payload: { enabled: !rule.enabled } },
      {
        onSuccess: () => toast.success(t('dq.updated')),
        onError: (e) => toast.error(t('dq.error.update'), e.message),
      },
    );
  }

  return (
    <Drawer
      open={ruleId !== null}
      onClose={onClose}
      size="xl"
      title={ruleQuery.data?.ruleName ?? ruleId ?? ''}
      footer={
        ruleId !== null ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleToggle(ruleQuery.data)}
              disabled={updateMut.isPending}
            >
              {ruleQuery.data?.enabled === true ? t('dq.disable') : t('dq.enable')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRun}
              disabled={runMut.isPending}
            >
              {runMut.isPending ? t('dq.running') : t('dq.run')}
            </Button>
          </div>
        ) : null
      }
    >
      {ruleQuery.isLoading ? (
        <ScreenLoading rows={3} />
      ) : ruleQuery.isError ? (
        <ScreenError error={ruleQuery.error} onRetry={() => void ruleQuery.refetch()} compact />
      ) : ruleQuery.data === undefined ? (
        <EmptyState compact title={t('common.error')} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tag size="sm" variant={SEVERITY_VARIANT[ruleQuery.data.severity]}>
              {ruleQuery.data.severity}
            </Tag>
            <Tag size="sm" variant="info">
              {ruleQuery.data.ruleType}
            </Tag>
            <Tag size="sm" variant={STATUS_VARIANT[ruleQuery.data.status]}>
              {ruleQuery.data.status}
            </Tag>
            <span className="font-mono text-[10px] text-neutral-500">
              {ruleQuery.data.tableName}
            </span>
          </div>

          <TabsRoot value={tab} onValueChange={(v) => setTab(v as DetailTab)}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="expression">Expression</TabsTrigger>
              <TabsTrigger value="runs">Runs</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Column
                  </p>
                  <p className="mt-1 font-mono text-xs text-neutral-300">
                    {ruleQuery.data.columnName ?? '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Last result
                  </p>
                  <p className="mt-1 text-sm font-bold text-neutral-700 dark:text-neutral-300">
                    {ruleQuery.data.lastRunResult ?? '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Failed rows
                  </p>
                  <p className="mt-1 text-sm font-bold text-neutral-700 dark:text-neutral-300">
                    {ruleQuery.data.failedRows ?? '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Total rows
                  </p>
                  <p className="mt-1 text-sm font-bold text-neutral-700 dark:text-neutral-300">
                    {ruleQuery.data.totalRows ?? '—'}
                  </p>
                </div>
              </div>
              {ruleQuery.data.description !== undefined ? (
                <p className="mt-2 text-xs text-neutral-500">
                  {ruleQuery.data.description}
                </p>
              ) : null}
              <p className="mt-2 text-[10px] text-neutral-500">
                Last run: {formatTime(ruleQuery.data.lastRunAt)}
              </p>
            </TabsContent>

            <TabsContent value="expression">
              <pre className="rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-xs leading-relaxed text-emerald-200">
                {ruleQuery.data.expression}
              </pre>
            </TabsContent>

            <TabsContent value="runs">
              <DQRunList
                runs={runsQuery.data}
                isLoading={runsQuery.isLoading}
                isError={runsQuery.isError}
                error={runsQuery.error}
                onRetry={() => void runsQuery.refetch()}
                onSelect={setSelectedRunId}
                selectedRunId={selectedRunId ?? undefined}
              />
            </TabsContent>
          </TabsRoot>
        </div>
      )}
    </Drawer>
  );
}