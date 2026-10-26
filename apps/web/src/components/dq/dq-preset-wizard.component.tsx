import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Field, Modal, Select, Tag } from '@/components';
import { DatasetPicker } from '@/components/dataset-picker';
import { useToast } from '@/hooks';
import {
  useApplyDQPresetMutation,
  useDQPresetCheckQuery,
  useDQPresetsQuery,
} from '@/services/queries';
import { getErrorMessage } from '@/services/api';
import type { DQPreset, EDQLayer, EDQSeverity } from '@/types/entities';

/**
 * The preset wizard.
 *
 * MASTER PLAN DQ-009: "Preset wizard checks columns/type, applies
 * idempotently to selected dataset/version, asks confirm."
 *
 * The wizard therefore has three explicit steps:
 *
 *   1. **Select** — the preset template and the target dataset/column.
 *   2. **Check**  — the server validates the column and its physical type
 *      against the rule type and reports *why* it does not fit when it does
 *      not. Nothing is created here.
 *   3. **Confirm** — the user confirms, and exactly one rule is created
 *      (idempotently — a repeated apply returns the existing rule).
 *
 * No unrelated rule of the catalogue is ever created.
 */

const SEVERITIES: ReadonlyArray<EDQSeverity> = ['low', 'medium', 'high', 'critical'];

export interface DQPresetWizardProps {
  open: boolean;
  onClose: () => void;
  /** The dataset pre-selected when the wizard opens. */
  defaultLayer?: EDQLayer;
  defaultTable?: string;
  defaultColumn?: string;
  /** The preset pre-selected when the wizard opens. */
  defaultPresetId?: string;
  onApplied?: (ruleId: string) => void;
}

export function DQPresetWizard({
  open,
  onClose,
  defaultLayer,
  defaultTable,
  defaultColumn,
  defaultPresetId,
  onApplied,
}: DQPresetWizardProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [presetId, setPresetId] = useState<string>(defaultPresetId ?? '');
  const [layer, setLayer] = useState<EDQLayer>(defaultLayer ?? 'silver');
  const [table, setTable] = useState<string>(defaultTable ?? '');
  const [column, setColumn] = useState<string>(defaultColumn ?? '');
  const [severity, setSeverity] = useState<EDQSeverity>('medium');
  const [enabled, setEnabled] = useState<boolean>(false);
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const presetsQuery = useDQPresetsQuery();
  const presets = presetsQuery.data ?? [];

  const target = useMemo(() => {
    if (table.trim() === '') return null;
    return {
      layer,
      table: table.trim(),
      ...(column.trim() !== '' ? { column: column.trim() } : {}),
    };
  }, [layer, table, column]);

  const checkQuery = useDQPresetCheckQuery(presetId, target);
  const applyMutation = useApplyDQPresetMutation();

  useEffect(() => {
    if (!open) return;
    setPresetId(defaultPresetId ?? '');
    setLayer(defaultLayer ?? 'silver');
    setTable(defaultTable ?? '');
    setColumn(defaultColumn ?? '');
    setConfirmed(false);
    setEnabled(false);
  }, [open, defaultPresetId, defaultLayer, defaultTable, defaultColumn]);

  // The severity of the preset is the default; the user can override it.
  useEffect(() => {
    const preset = presets.find((candidate) => candidate.presetId === presetId);
    if (preset?.severity !== undefined) setSeverity(preset.severity);
  }, [presetId, presets]);

  const selectedPreset: DQPreset | undefined = presets.find(
    (candidate) => candidate.presetId === presetId,
  );
  const check = checkQuery.data;
  const applicable = check?.applicable === true;

  function close(): void {
    setConfirmed(false);
    onClose();
  }

  async function submit(): Promise<void> {
    if (presetId === '' || target === null) return;
    try {
      const result = await applyMutation.mutateAsync({
        presetId,
        target,
        severity,
        enabled,
      });
      toast.success(
        result.existing
          ? t('dq.preset.alreadyApplied')
          : t('dq.preset.applied', { id: result.rule.ruleId }),
      );
      onApplied?.(result.rule.ruleId);
      close();
    } catch (error) {
      toast.error(t('dq.preset.error'), getErrorMessage(error));
    }
  }

  const presetOptions = presets.map((preset) => ({
    value: preset.presetId,
    label: preset.name,
  }));

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={t('dq.preset.title')}
      description={t('dq.preset.description')}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!applicable || !confirmed || applyMutation.isPending}
            onClick={() => void submit()}
          >
            {applyMutation.isPending ? t('dq.preset.applying') : t('dq.preset.apply')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {presetsQuery.isError ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-[11px] text-red-500">
            {getErrorMessage(presetsQuery.error)}
          </div>
        ) : null}

        <Field label={t('dq.preset.field.preset')} hint={t('dq.preset.hint.preset')}>
          <Select
            selectSize="sm"
            value={presetId}
            onChange={(event) => {
              setPresetId(event.target.value);
              setConfirmed(false);
            }}
            placeholder={t('dq.preset.field.presetPlaceholder')}
            options={presetOptions}
          />
        </Field>

        {selectedPreset !== undefined ? (
          <div className="rounded-lg border border-white/5 bg-white/5 p-3">
            <p className="text-[11px] text-neutral-600 dark:text-neutral-300">
              {selectedPreset.description}
            </p>
            {selectedPreset.type !== undefined ? (
              <div className="mt-2 flex flex-wrap gap-1">
                <Tag size="sm" variant="info">
                  {selectedPreset.type}
                </Tag>
                {selectedPreset.layer !== undefined ? (
                  <Tag size="sm" variant="neutral">
                    {selectedPreset.layer}
                  </Tag>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* The dataset and the column are *picked*, never typed. The user
            cannot know the exact `database.table` spelling of a dataset or
            the exact column names, so asking for them in a text field made
            the wizard unusable. The picker resolves both from the catalog. */}
        <Field
          label={t('dq.preset.field.table')}
          hint={t('dq.preset.hint.table')}
        >
          <DatasetPicker
            value={
              table === ''
                ? null
                : {
                    tableId: table,
                    database: table.split('.')[0] ?? '',
                    table: table.split('.')[1] ?? table,
                    layer,
                  }
            }
            onChange={(picked) => {
              setTable(picked === null ? '' : picked.tableId);
              setConfirmed(false);
            }}
            onColumnChange={(picked) => {
              setColumn(picked ?? '');
              setConfirmed(false);
            }}
            withColumn
            column={column === '' ? null : column}
            defaultLayer={layer}
            onLayerChange={(picked) => {
              if (picked !== layer) {
                setLayer(picked);
                setConfirmed(false);
              }
            }}
          />
        </Field>
        {/* The applicability report — the reason the preset can or cannot
            be applied is always shown, never swallowed. */}
        {target !== null && presetId !== '' ? (
          <div
            className={`rounded-lg border p-3 text-[11px] ${
              applicable
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                : 'border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400'
            }`}
          >
            {checkQuery.isLoading ? (
              <p>{t('dq.preset.checking')}</p>
            ) : checkQuery.isError ? (
              <p>{getErrorMessage(checkQuery.error)}</p>
            ) : check === undefined ? (
              <p>{t('dq.preset.checking')}</p>
            ) : applicable ? (
              <p>
                {t('dq.preset.applicable', {
                  column: check.column ?? '—',
                  type: check.columnType ?? '—',
                })}
              </p>
            ) : (
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {check.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('dq.preset.field.severity')}>
            <Select
              selectSize="sm"
              value={severity}
              onChange={(event) => setSeverity(event.target.value as EDQSeverity)}
              options={SEVERITIES.map((value) => ({ value, label: value }))}
            />
          </Field>
          <label className="flex items-end gap-2 pb-1 text-xs text-neutral-700 dark:text-neutral-200">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5"
            />
            {t('dq.preset.field.enableNow')}
          </label>
        </div>

        <label className="flex items-start gap-2 text-xs text-neutral-700 dark:text-neutral-200">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={!applicable}
            className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5"
          />
          <span>{t('dq.preset.field.confirm')}</span>
        </label>

        <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[10px] text-amber-600 dark:text-amber-400">
          {t('dq.preset.draftWarning')}
        </p>
      </div>
    </Modal>
  );
}
