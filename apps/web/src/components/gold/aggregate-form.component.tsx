import { useTranslation } from 'react-i18next';
import {
  Modal,
  Field,
  SelectField,
  Textarea,
  Button,
} from '@/components';
import { useFormZod, useToast } from '@/hooks';
import { aggregatePayloadSchema } from '@/schemas';
import { useAggregateMutation } from '@/services/queries';

type Values = {
  groupByText: string;
  metricsText: string;
};

const INITIAL: Values = {
  groupByText: '',
  metricsText: 'amount,sum\nquantity,avg',
};

export interface AggregateFormProps {
  open: boolean;
  table: string;
  onClose: () => void;
  onResult?: () => void;
}

export function AggregateForm({ open, table, onClose, onResult }: AggregateFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const form = useFormZod<Values>(aggregatePayloadSchema, INITIAL);
  const mut = useAggregateMutation();

  function parsePayload(): { groupBy: string[]; metrics: { name: string; op: 'sum' | 'avg' | 'count' | 'min' | 'max' }[] } | null {
    const groupBy = form.values.groupByText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (groupBy.length === 0) {
      toast.error(t('aggregate.errors.groupByRequired'));
      return null;
    }
    const metrics: { name: string; op: 'sum' | 'avg' | 'count' | 'min' | 'max' }[] = [];
    for (const line of form.values.metricsText.split(/\n/)) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      const [nameRaw, opRaw] = trimmed.split(',').map((s) => s.trim());
      if (nameRaw === undefined || nameRaw.length === 0) {
        toast.error(t('aggregate.errors.metricNameRequired'));
        return null;
      }
      const op = opRaw ?? 'sum';
      if (!['sum', 'avg', 'count', 'min', 'max'].includes(op)) {
        toast.error(t('aggregate.errors.invalidOp', { op }));
        return null;
      }
      metrics.push({ name: nameRaw, op: op as 'sum' | 'avg' | 'count' | 'min' | 'max' });
    }
    if (metrics.length === 0) {
      toast.error(t('aggregate.errors.metricRequired'));
      return null;
    }
    return { groupBy, metrics };
  }

  async function handleSubmit(): Promise<void> {
    if (!form.validate()) return;
    const payload = parsePayload();
    if (payload === null) return;
    try {
      await mut.mutateAsync({ table, payload });
      toast.success(t('aggregate.success'));
      onResult?.();
      handleClose();
    } catch (e) {
      toast.error(t('aggregate.error.submit'), e instanceof Error ? e.message : '');
    }
  }

  function handleClose(): void {
    form.reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('aggregate.title')}
      description={t('aggregate.description', { table })}
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={mut.isPending}
          >
            {mut.isPending ? t('aggregate.submitting') : t('aggregate.submit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field
          label="Group by columns"
          required
          hint={t('aggregate.hint.groupBy')}
        >
          <Textarea
            value={form.values.groupByText}
            onChange={(e) => form.setField('groupByText', e.target.value)}
            placeholder="category, region"
            rows={2}
            className="font-mono"
          />
        </Field>
        <Field
          label="Metrics"
          required
          hint={t('aggregate.hint.metrics')}
        >
          <Textarea
            value={form.values.metricsText}
            onChange={(e) => form.setField('metricsText', e.target.value)}
            placeholder="amount,sum\nquantity,avg"
            rows={4}
            className="font-mono"
          />
        </Field>
        <Field label="Aggregation type">
          <SelectField
            value="group_by"
            onChange={() => {
              /* fixed for now */
            }}
            options={[
              { value: 'group_by', label: 'group_by' },
              { value: 'sum', label: 'sum' },
              { value: 'avg', label: 'avg' },
              { value: 'count', label: 'count' },
            ]}
          />
        </Field>
      </div>
    </Modal>
  );
}