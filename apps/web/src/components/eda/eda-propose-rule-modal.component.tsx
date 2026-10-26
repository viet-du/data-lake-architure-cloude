import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Field, Input, Modal, Select, Tag } from '@/components';
import { useToast } from '@/hooks';
import { useProposeEdaRuleMutation } from '@/services/queries';
import { getErrorMessage } from '@/services/api';
import type { EColumnProfile } from '@/types/entities';

/**
 * The EDA → DQ bridge.
 *
 * MASTER PLAN §07.5: an EDA finding *suggests* a rule. The rule is created
 * as a **draft** (disabled) so the domain owner reviews it — the bridge
 * never silently auto-applies a rule. The modal therefore defaults to
 * "disabled" and shows the threshold the profile observed.
 */

const valuesSchema = z.object({
  type: z.enum(['null_check', 'range_check', 'in_set', 'unique', 'regex']),
  name: z.string().trim().min(1).max(255),
  threshold: z.string(),
  enabled: z.boolean(),
});

type Values = z.infer<typeof valuesSchema>;

export interface EdaProposeRuleModalProps {
  open: boolean;
  onClose: () => void;
  profileId: string;
  column: EColumnProfile | null;
  onProposed?: (ruleId: string) => void;
}

/** The observed null percentage of a column, or `null` when not measurable. */
function observedNullPercent(column: EColumnProfile | null): number | null {
  if (column === null) return null;
  const total = Number(column.nonNullCount) + Number(column.nullCount);
  if (!Number.isFinite(total) || total <= 0) return null;
  return (Number(column.nullCount) / total) * 100;
}

export function EdaProposeRuleModal({
  open,
  onClose,
  profileId,
  column,
  onProposed,
}: EdaProposeRuleModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const mutation = useProposeEdaRuleMutation();
  const [values, setValues] = useState<Values>({
    type: 'null_check',
    name: '',
    threshold: '',
    enabled: false,
  });

  const nullPercent = useMemo(() => observedNullPercent(column), [column]);

  useEffect(() => {
    if (!open || column === null) return;
    setValues({
      type: 'null_check',
      name: `${column.name} · not_null`,
      threshold: nullPercent === null ? '' : nullPercent.toFixed(2),
      enabled: false,
    });
  }, [open, column, nullPercent]);

  if (column === null) return null;

  async function submit(): Promise<void> {
    const parsed = valuesSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(t('eda.error.ruleInvalid'), parsed.error.issues[0]?.message ?? '');
      return;
    }
    try {
      const rule = await mutation.mutateAsync({
        profileId,
        column: column?.name ?? '',
        type: parsed.data.type,
        ...(parsed.data.threshold !== '' ? { threshold: Number(parsed.data.threshold) } : {}),
        name: parsed.data.name,
        enabled: parsed.data.enabled,
      });
      toast.success(t('eda.ruleProposed', { id: rule.ruleId }));
      onProposed?.(rule.ruleId);
      onClose();
    } catch (error) {
      toast.error(t('eda.error.rule'), getErrorMessage(error));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eda.proposeTitle')}
      description={t('eda.proposeDescription', { column: column.name })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={mutation.isPending}
            onClick={() => void submit()}
          >
            {mutation.isPending ? t('eda.proposing') : t('eda.proposeRule')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/5 p-3">
          <span className="font-mono text-xs text-neutral-800 dark:text-neutral-100">
            {column.name}
          </span>
          <Tag size="sm" variant="info">
            {column.logicalType}
          </Tag>
          <span className="text-[10px] text-neutral-500">
            {t('eda.proposeObservedNulls', { value: nullPercent?.toFixed(2) ?? '—' })}
          </span>
        </div>

        <Field label={t('eda.field.ruleType')}>
          <Select
            selectSize="sm"
            value={values.type}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                type: event.target.value as Values['type'],
              }))
            }
            options={[
              { value: 'null_check', label: 'not_null' },
              { value: 'range_check', label: 'range' },
              { value: 'in_set', label: 'in_set' },
              { value: 'unique', label: 'unique' },
              { value: 'regex', label: 'regex' },
            ]}
          />
        </Field>

        <Field label={t('eda.field.ruleName')}>
          <Input
            inputSize="sm"
            value={values.name}
            onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
          />
        </Field>

        <Field label={t('eda.field.threshold')} hint={t('eda.hint.threshold')}>
          <Input
            inputSize="sm"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={values.threshold}
            onChange={(event) => setValues((prev) => ({ ...prev, threshold: event.target.value }))}
          />
        </Field>

        <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-200">
          <input
            type="checkbox"
            checked={values.enabled}
            onChange={(event) => setValues((prev) => ({ ...prev, enabled: event.target.checked }))}
            className="h-4 w-4 rounded border-white/20 bg-white/5"
          />
          {t('eda.field.enableNow')}
        </label>

        <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[10px] text-amber-600 dark:text-amber-400">
          {t('eda.proposeDraftWarning')}
        </p>
      </div>
    </Modal>
  );
}
