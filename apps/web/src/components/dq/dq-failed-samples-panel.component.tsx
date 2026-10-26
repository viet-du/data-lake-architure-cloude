import { useTranslation } from 'react-i18next';
import { Button, EmptyState, SamplePreview, ScreenError, ScreenLoading, Tag } from '@/components';
import { useDQFailedSamplesQuery } from '@/services/queries';
import type { EDQOutcome } from '@/types/entities';

/**
 * The failed-sample panel.
 *
 * MASTER PLAN §06.5: the samples are *representative* only — the cap is
 * bounded (1–100) and the values are redacted **on the server** before they
 * leave the API. The panel therefore states the cap explicitly instead of
 * pretending the list is complete.
 */

const OUTCOME_VARIANT: Readonly<Record<EDQOutcome, 'success' | 'error' | 'warning' | 'info' | 'neutral'>> = {
  pass: 'success',
  fail: 'error',
  warn: 'warning',
  error: 'error',
  not_evaluated: 'neutral',
};

export interface DQFailedSamplesPanelProps {
  runId: string | null;
  limit?: number;
  className?: string;
}

export function DQFailedSamplesPanel({
  runId,
  limit = 10,
  className,
}: DQFailedSamplesPanelProps) {
  const { t } = useTranslation();
  const samplesQuery = useDQFailedSamplesQuery(runId ?? '', limit);

  if (runId === null || runId === '') {
    return <EmptyState compact title={t('dq.samples.selectRun')} />;
  }
  if (samplesQuery.isLoading) return <ScreenLoading rows={3} />;
  if (samplesQuery.isError) {
    return (
      <ScreenError
        error={samplesQuery.error}
        onRetry={() => void samplesQuery.refetch()}
        compact
      />
    );
  }

  const samples = samplesQuery.data;
  if (samples === undefined) return <EmptyState compact title={t('dq.samples.empty')} />;

  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Tag size="sm" variant={OUTCOME_VARIANT[samples.status]}>
          {samples.status}
        </Tag>
        <span className="text-[10px] text-neutral-500">
          {t('dq.samples.count', {
            returned: samples.returned,
            total: samples.total,
          })}
        </span>
        {samples.truncated ? (
          <Tag size="sm" variant="warning">
            {t('dq.samples.truncated')}
          </Tag>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void samplesQuery.refetch()}
          className="ml-auto"
        >
          {t('common.refresh')}
        </Button>
      </div>

      {samples.rows.length === 0 ? (
        <EmptyState compact title={t('dq.samples.empty')} />
      ) : (
        <SamplePreview
          columns={samples.columns}
          rows={samples.rows}
          isLoading={false}
          isError={false}
          maxRows={limit}
        />
      )}

      <p className="text-[10px] text-neutral-500">{t('dq.samples.redactionNote')}</p>
    </div>
  );
}
