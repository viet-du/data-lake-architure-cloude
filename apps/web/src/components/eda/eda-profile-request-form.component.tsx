import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Field, Input, Modal, Select, Tag } from '@/components';
import { DatasetPicker, type DatasetPickerValue } from '@/components/dataset-picker';
import { useFormZod, useToast } from '@/hooks';
import { useCreateEdaProfileMutation } from '@/services/queries';
import type {
  ECreateProfilePayload,
  EProfileAnalysis,
  ESamplePolicy,
} from '@/types/entities';
import { getErrorMessage } from '@/services/api';

/**
 * The profile request wizard.
 *
 * The form names a *dataset*, never a path — the server resolves the
 * storage location. The request is typed: the analyses and the sampling
 * policy are allow-listed, so there is no way to smuggle a free-form query
 * into the profiler from the browser.
 */

const valuesSchema = z.object({
  tableId: z.string().trim().min(1),
  analyses: z.array(z.string()).min(1),
  includeCorrelation: z.boolean(),
  samplePolicy: z.enum(['full', 'sample', 'stratified']),
  sampleSize: z.string(),
  seed: z.string(),
});
type Values = z.infer<typeof valuesSchema>;

const INITIAL: Values = {
  tableId: '',
  analyses: ['structure', 'univariate'],
  includeCorrelation: false,
  samplePolicy: 'full',
  sampleSize: '10000',
  seed: '42',
};

const ALL_ANALYSES: ReadonlyArray<EProfileAnalysis> = [
  'structure',
  'univariate',
  'categorical',
  'correlation',
  'temporal',
];

export interface EdaProfileRequestFormProps {
  open: boolean;
  onClose: () => void;
  /** The dataset pre-selected when the form opens. */
  defaultTableId?: string;
  onCreated?: (profileId: string) => void;
}

export function EdaProfileRequestForm({
  open,
  onClose,
  defaultTableId,
  onCreated,
}: EdaProfileRequestFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const form = useFormZod(valuesSchema, INITIAL);
  const [dataset, setDataset] = useState<DatasetPickerValue | null>(null);
  const [columns, setColumns] = useState<ReadonlyArray<{ name: string; type: string }>>([]);
  const mutation = useCreateEdaProfileMutation();

  // A dataset handed in by the caller is pre-selected. The id is split on
  // the dots the same way the picker reports it, so the picker shows the
  // entry as already chosen instead of an unrelated list.
  useEffect(() => {
    if (!open || defaultTableId === undefined || defaultTableId === '') return;
    const parts = defaultTableId.split('.');
    setDataset({
      tableId: defaultTableId,
      database: parts[0] ?? '',
      table: parts.length > 2 ? parts.slice(2).join('.') : (parts[1] ?? defaultTableId),
      layer: 'bronze',
    });
    form.setField('tableId', defaultTableId);
  }, [open, defaultTableId, form]);

  function close(): void {
    form.reset();
    setDataset(null);
    setColumns([]);
    onClose();
  }

  function toggleAnalysis(analysis: EProfileAnalysis): void {
    const current = form.values.analyses;
    const next = current.includes(analysis)
      ? current.filter((item) => item !== analysis)
      : [...current, analysis];
    if (next.length === 0) return;
    form.setField('analyses', next);
  }

  async function submit(): Promise<void> {
    const selected = dataset?.tableId ?? form.values.tableId;
    if (selected === '') {
      toast.error(t('eda.error.datasetRequired'));
      return;
    }
    // The picker guarantees a valid dataset, but the schema also validates,
    // so the form state is brought in line before validating.
    form.setField('tableId', selected);
    if (!form.validate()) return;

    const payload: ECreateProfilePayload = {
      dataset: { datasetId: selected },
      columns: [],
      analyses: form.values.analyses as ReadonlyArray<EProfileAnalysis>,
      includeCorrelation: form.values.includeCorrelation,
      samplePolicy: form.values.samplePolicy as ESamplePolicy,
      ...(form.values.samplePolicy !== 'full'
        ? { sampleSize: Number(form.values.sampleSize) }
        : {}),
      ...(form.values.seed !== '' ? { seed: Number(form.values.seed) } : {}),
    };

    try {
      const accepted = await mutation.mutateAsync(payload);
      toast.success(t('eda.profileCreated', { id: accepted.profileId }));
      onCreated?.(accepted.profileId);
      close();
    } catch (error) {
      toast.error(t('eda.error.profile'), getErrorMessage(error));
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={t('eda.requestTitle')}
      description={t('eda.requestDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={mutation.isPending}
            onClick={() => void submit()}
          >
            {mutation.isPending ? t('eda.profiling') : t('eda.runProfile')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label={t('eda.field.dataset')}
          hint={t('eda.hint.dataset')}
          error={form.errors.tableId}
        >
          <div className="flex flex-col gap-2">
            <DatasetPicker
              value={dataset}
              onChange={(picked) => {
                setDataset(picked);
                form.setField('tableId', picked?.tableId ?? '');
              }}
              onColumnsChange={setColumns}
            />
            {/* The resolved columns are shown so the user can confirm *what*
                will be profiled — before the scan runs, not after. */}
            {dataset !== null && columns.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 p-2">
                <span className="text-[10px] text-neutral-500">
                  {t('eda.field.columnsResolved', { count: columns.length })}
                </span>
                {columns.slice(0, 12).map((column) => (
                  <Tag key={column.name} size="sm" variant="neutral">
                    {column.name}
                  </Tag>
                ))}
                {columns.length > 12 ? (
                  <Tag size="sm" variant="info">
                    {t('eda.field.moreColumns', { count: columns.length - 12 })}
                  </Tag>
                ) : null}
              </div>
            ) : null}
          </div>
        </Field>

        <Field label={t('eda.field.analyses')} hint={t('eda.hint.analyses')}>
          <div className="flex flex-wrap gap-1.5">
            {ALL_ANALYSES.map((analysis) => {
              const active = form.values.analyses.includes(analysis);
              return (
                <button
                  key={analysis}
                  type="button"
                  onClick={() => toggleAnalysis(analysis)}
                  className={
                    active
                      ? 'rounded-full border border-primary-500/40 bg-primary-500/15 px-2.5 py-1 text-[10px] font-medium text-primary-600 dark:text-primary-300'
                      : 'rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-neutral-500 hover:bg-white/10'
                  }
                >
                  {analysis}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t('eda.field.sampling')} hint={t('eda.hint.sampling')}>
            <Select
              selectSize="sm"
              value={form.values.samplePolicy}
              onChange={(event) =>
                form.setField('samplePolicy', event.target.value as Values['samplePolicy'])
              }
              options={[
                { value: 'full', label: t('eda.sampling.full') },
                { value: 'sample', label: t('eda.sampling.sample') },
                { value: 'stratified', label: t('eda.sampling.stratified') },
              ]}
            />
          </Field>
          <Field
            label={t('eda.field.sampleSize')}
            hint={t('eda.hint.sampleSize')}
            error={form.errors.sampleSize}
          >
            <Input
              inputSize="sm"
              type="number"
              min={100}
              disabled={form.values.samplePolicy === 'full'}
              value={form.values.sampleSize}
              onChange={(event) => form.setField('sampleSize', event.target.value)}
            />
          </Field>
          <Field label={t('eda.field.seed')} hint={t('eda.hint.seed')}>
            <Input
              inputSize="sm"
              type="number"
              min={0}
              value={form.values.seed}
              onChange={(event) => form.setField('seed', event.target.value)}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-200">
          <input
            type="checkbox"
            checked={form.values.includeCorrelation}
            onChange={(event) => form.setField('includeCorrelation', event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-white/5"
          />
          {t('eda.field.correlation')}
          <Tag size="sm" variant="warning">
            {t('eda.correlationCost')}
          </Tag>
        </label>
      </div>
    </Modal>
  );
}
