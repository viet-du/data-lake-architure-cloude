import { useTranslation } from 'react-i18next';
import { EmptyState, ScreenLoading, ScreenError } from '@/components';

export interface AirflowTaskLogsProps {
  logs: string | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  taskId?: string;
  tryNumber?: number;
}

export function AirflowTaskLogs({
  logs,
  isLoading,
  isError,
  error,
  onRetry,
  taskId,
  tryNumber,
}: AirflowTaskLogsProps) {
  const { t } = useTranslation();
  if (isLoading) return <ScreenLoading rows={4} />;
  if (isError) {
    return <ScreenError error={error ?? new Error('Unknown error')} onRetry={onRetry} compact />;
  }
  if (logs === undefined || logs.length === 0) {
    return <EmptyState compact title={t('airflow.noLogs')} />;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">
        {taskId ?? 'task'}
        {tryNumber !== undefined ? ` · try #${tryNumber}` : ''}
      </p>
      <pre className="max-h-[480px] overflow-auto rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-emerald-200">
        {logs}
      </pre>
    </div>
  );
}