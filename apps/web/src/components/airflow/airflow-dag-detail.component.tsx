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
  useDAGQuery,
  useDAGRunsQuery,
  useDAGRunTasksQuery,
  useDAGRunGanttQuery,
  usePauseDAGMutation,
  useUnpauseDAGMutation,
  useTriggerDAGMutation,
} from '@/services/queries';
import { useToast } from '@/hooks';
import { AirflowRunList } from './airflow-run-list.component';
import { AirflowTaskList } from './airflow-task-list.component';
import { AirflowGanttChart } from './airflow-gantt-chart.component';
import type { AirflowDAG, EDagState } from '@/types/entities';
import type { EHealthStatus } from '@/types/commons';

export interface AirflowDAGDetailProps {
  dagId: string | null;
  onClose: () => void;
}

type DetailTab = 'overview' | 'runs' | 'tasks' | 'gantt';

const STATE_VARIANT: Readonly<Record<EDagState, 'success' | 'error' | 'info' | 'warning'>> = {
  success: 'success',
  failed: 'error',
  running: 'info',
  queued: 'warning',
};

const HEALTH_VARIANT: Readonly<Record<EHealthStatus, 'success' | 'warning' | 'error'>> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'error',
};

function formatTime(s: string | undefined): string {
  if (s === undefined) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

export function AirflowDAGDetail({ dagId, onClose }: AirflowDAGDetailProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [tab, setTab] = useState<DetailTab>('overview');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const dagQuery = useDAGQuery(dagId ?? '');
  const runsQuery = useDAGRunsQuery(dagId ?? '', { limit: 20 });
  const tasksQuery = useDAGRunTasksQuery(dagId ?? '', selectedRunId ?? '');
  const ganttQuery = useDAGRunGanttQuery(dagId ?? '', selectedRunId ?? '');
  const triggerMut = useTriggerDAGMutation();
  const pauseMut = usePauseDAGMutation();
  const unpauseMut = useUnpauseDAGMutation();

  function handleTrigger(): void {
    if (dagId === null) return;
    triggerMut.mutate(
      { dagId, payload: {} },
      {
        onSuccess: (r) =>
          toast.success(t('airflow.triggered', { runId: r.runId.slice(0, 12) })),
        onError: (e) => toast.error(t('airflow.error.trigger'), e.message),
      },
    );
  }

  function handleTogglePause(dag: AirflowDAG | undefined): void {
    if (dagId === null || dag === undefined) return;
    if (dag.isPaused) {
      unpauseMut.mutate(dagId, {
        onSuccess: () => toast.success(t('airflow.unpaused')),
        onError: (e) => toast.error(t('airflow.error.toggle'), e.message),
      });
    } else {
      pauseMut.mutate(dagId, {
        onSuccess: () => toast.success(t('airflow.paused')),
        onError: (e) => toast.error(t('airflow.error.toggle'), e.message),
      });
    }
  }

  return (
    <Drawer
      open={dagId !== null}
      onClose={onClose}
      size="xl"
      title={dagId ?? ''}
      footer={
        dagId !== null ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleTogglePause(dagQuery.data)}
              disabled={pauseMut.isPending || unpauseMut.isPending}
            >
              {dagQuery.data?.isPaused === true ? t('airflow.unpause') : t('airflow.pause')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleTrigger}
              disabled={triggerMut.isPending || dagQuery.data?.isPaused === true}
            >
              {triggerMut.isPending ? t('airflow.triggering') : t('airflow.trigger')}
            </Button>
          </div>
        ) : null
      }
    >
      {dagQuery.isLoading ? (
        <ScreenLoading rows={3} />
      ) : dagQuery.isError ? (
        <ScreenError error={dagQuery.error} onRetry={() => void dagQuery.refetch()} compact />
      ) : dagQuery.data === undefined ? (
        <EmptyState compact title={t('common.error')} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tag size="sm" variant={dagQuery.data.isPaused ? 'neutral' : 'primary'}>
              {dagQuery.data.isPaused ? 'paused' : 'active'}
            </Tag>
            <Tag size="sm" variant={HEALTH_VARIANT[dagQuery.data.status]}>
              {dagQuery.data.status}
            </Tag>
            {dagQuery.data.lastRunState !== undefined ? (
              <Tag size="sm" variant={STATE_VARIANT[dagQuery.data.lastRunState]}>
                last: {dagQuery.data.lastRunState}
              </Tag>
            ) : null}
            {dagQuery.data.scheduleInterval !== undefined ? (
              <Tag size="sm" variant="neutral">
                {dagQuery.data.scheduleInterval}
              </Tag>
            ) : null}
          </div>
          {dagQuery.data.description !== undefined ? (
            <p className="text-xs text-neutral-500">{dagQuery.data.description}</p>
          ) : null}

          <TabsRoot value={tab} onValueChange={(v) => setTab(v as DetailTab)}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="runs">Runs</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="gantt">Gantt</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">Tags</p>
                  <p className="mt-1 text-base font-bold text-neutral-900 dark:text-neutral-50">
                    {dagQuery.data.tags.length}
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">Last run</p>
                  <p className="mt-1 text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {formatTime(dagQuery.data.lastRunAt)}
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">Next run</p>
                  <p className="mt-1 text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {formatTime(dagQuery.data.nextRunAt)}
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">Owners</p>
                  <p className="mt-1 text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {Object.keys(dagQuery.data.ownerLinks).length}
                  </p>
                </div>
              </div>
              {dagQuery.data.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {dagQuery.data.tags.map((tag) => (
                    <Tag key={tag} size="sm" variant="info">
                      {tag}
                    </Tag>
                  ))}
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="runs">
              <AirflowRunList
                runs={runsQuery.data}
                isLoading={runsQuery.isLoading}
                isError={runsQuery.isError}
                error={runsQuery.error}
                onRetry={() => void runsQuery.refetch()}
                onSelect={setSelectedRunId}
                selectedRunId={selectedRunId ?? undefined}
              />
            </TabsContent>

            <TabsContent value="tasks">
              {selectedRunId === null ? (
                <EmptyState compact title={t('airflow.selectRun')} />
              ) : (
                <AirflowTaskList
                  tasks={tasksQuery.data}
                  isLoading={tasksQuery.isLoading}
                  isError={tasksQuery.isError}
                  error={tasksQuery.error}
                  onRetry={() => void tasksQuery.refetch()}
                />
              )}
            </TabsContent>

            <TabsContent value="gantt">
              {selectedRunId === null ? (
                <EmptyState compact title={t('airflow.selectRun')} />
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] text-neutral-500">
                    {t('airflow.runId')}: {selectedRunId.slice(0, 12)}
                    {ganttQuery.data !== undefined
                      ? ` · ${ganttQuery.data.length} tasks`
                      : ''}
                  </p>
                  <AirflowGanttChart
                    entries={ganttQuery.data}
                    isLoading={ganttQuery.isLoading}
                    isError={ganttQuery.isError}
                    error={ganttQuery.error}
                    onRetry={() => void ganttQuery.refetch()}
                  />
                </div>
              )}
            </TabsContent>
          </TabsRoot>
        </div>
      )}
    </Drawer>
  );
}
