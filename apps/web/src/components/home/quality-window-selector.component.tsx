import { useTranslation } from 'react-i18next';
import { Select } from '@/components';
import type { EDashboardQualityWindow } from '@/store';

/**
 * The quality measurement-window selector.
 *
 * MASTER PLAN §06.4: the quality pass rate must state its window and the
 * windows must never be mixed. The selector is the only way to change it,
 * and the choice is shared with the Schematic so the two screens always
 * describe the same population.
 *
 * Only the two windows the backend actually implements are offered.
 * `Latest per dataset` is a third window in the plan, but it needs a
 * different aggregation (one rule check per dataset/snapshot instead of
 * one per run); offering it before it exists would mean reporting a
 * number measured over a population the operator did not ask for.
 */
export interface QualityWindowSelectorProps {
  value: EDashboardQualityWindow;
  onChange: (value: EDashboardQualityWindow) => void;
  className?: string;
}

export function QualityWindowSelector({
  value,
  onChange,
  className,
}: QualityWindowSelectorProps) {
  const { t } = useTranslation();

  return (
    <label
      className={
        className ??
        'flex items-center gap-2 text-xs text-black dark:text-white'
      }
    >
      <span className="whitespace-nowrap uppercase tracking-wider">
        {t('home.quality_window.label')}
      </span>
      <Select
        selectSize="sm"
        fullWidth={false}
        aria-label={t('home.quality_window.label')}
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          if (next === '24h' || next === 'all') onChange(next);
        }}
        options={[
          { value: '24h', label: t('home.quality_window.24h') },
          { value: 'all', label: t('home.quality_window.all') },
        ]}
      />
    </label>
  );
}
