import { useTranslation } from 'react-i18next';
import { Tag } from '@/components';
import { cn } from '@/theme';
import type { EDatasetProfile, EProfileAlert } from '@/types/entities';
import {
  MetricTile,
  PROFILE_STATUS_VARIANT,
  formatCount,
  formatNumber,
  formatRatio,
  formatTime,
} from './eda.helpers';

/**
 * The profile summary panel.
 *
 * It answers the provenance questions the master plan makes mandatory:
 * *which* dataset, *which* snapshot, *how much* of it was observed, and
 * *how* it was computed.
 */

const ALERT_VARIANT: Readonly<Record<EProfileAlert['severity'], 'info' | 'warning' | 'error'>> = {
  info: 'info',
  warn: 'warning',
  error: 'error',
};

export interface EdaProfileSummaryProps {
  profile: EDatasetProfile;
  className?: string;
}

export function EdaProfileSummary({ profile, className }: EdaProfileSummaryProps) {
  const { t } = useTranslation();

  const observed = Number(profile.coverage.rowsObserved);
  const population = profile.population.rowCount === null ? null : Number(profile.population.rowCount);
  const coverageRatio =
    profile.coverage.ratio !== undefined
      ? profile.coverage.ratio
      : population !== null && population > 0
        ? observed / population
        : null;

  const approximate = profile.provenance.approximate;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Tag size="sm" variant={PROFILE_STATUS_VARIANT[profile.status]}>
          {profile.status}
        </Tag>
        {profile.dataset.layer !== undefined ? (
          <Tag size="sm" variant="neutral">
            {profile.dataset.layer}
          </Tag>
        ) : null}
        <Tag size="sm" variant="info">
          {profile.dataset.provider}
        </Tag>
        {approximate ? (
          <Tag size="sm" variant="warning">
            {t('eda.approximate')}
          </Tag>
        ) : null}
        <span className="font-mono text-[10px] text-neutral-500">{profile.dataset.datasetId}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile
          label={t('eda.summary.rows')}
          value={formatCount(profile.population.rowCount)}
          hint={profile.population.estimate ? t('eda.summary.estimated') : undefined}
        />
        <MetricTile
          label={t('eda.summary.observed')}
          value={formatCount(profile.coverage.rowsObserved)}
          hint={t('eda.summary.coverage', { value: formatRatio(coverageRatio) })}
        />
        <MetricTile label={t('eda.summary.columns')} value={String(profile.population.columnCount)} />
        <MetricTile
          label={t('eda.summary.sampling')}
          value={profile.provenance.samplePolicy}
          hint={
            profile.configured.sampleSize !== undefined
              ? t('eda.summary.sampleSize', { value: formatCount(profile.configured.sampleSize) })
              : undefined
          }
        />
        <MetricTile
          label={t('eda.summary.engine')}
          value={profile.provenance.engine}
          hint={
            profile.provenance.engineVersion !== undefined
              ? `v${profile.provenance.engineVersion}`
              : undefined
          }
        />
        <MetricTile
          label={t('eda.summary.elapsed')}
          value={
            profile.provenance.elapsedMs === undefined
              ? '—'
              : `${formatNumber(profile.provenance.elapsedMs, 0)} ms`
          }
          hint={t('eda.summary.computedAt', { value: formatTime(profile.provenance.computedAt) })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-[10px] text-neutral-500">
        <span>
          <span className="uppercase tracking-wider">{t('eda.summary.fingerprint')}: </span>
          <span className="font-mono text-neutral-400">{profile.fingerprint}</span>
        </span>
        {profile.provenance.queryHash !== undefined ? (
          <span>
            <span className="uppercase tracking-wider">{t('eda.summary.queryHash')}: </span>
            <span className="font-mono text-neutral-400">{profile.provenance.queryHash}</span>
          </span>
        ) : null}
        {profile.dataset.version !== undefined ? (
          <span>
            <span className="uppercase tracking-wider">{t('eda.summary.version')}: </span>
            <span className="font-mono text-neutral-400">v{profile.dataset.version}</span>
          </span>
        ) : null}
        <span>
          <span className="uppercase tracking-wider">{t('eda.summary.schemaVersion')}: </span>
          <span className="font-mono text-neutral-400">{profile.schemaVersion}</span>
        </span>
      </div>

      {profile.alerts.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {profile.alerts.map((alert, index) => (
            <div
              key={`${alert.kind}-${index}`}
              className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2"
            >
              <Tag size="sm" variant={ALERT_VARIANT[alert.severity]}>
                {alert.severity}
              </Tag>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-neutral-700 dark:text-neutral-200">
                  {alert.description}
                </p>
                {alert.columns !== undefined && alert.columns.length > 0 ? (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-neutral-500">
                    {alert.columns.join(', ')}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {profile.errorMessage !== undefined ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-500">
          {profile.errorMessage}
        </div>
      ) : null}
    </div>
  );
}
