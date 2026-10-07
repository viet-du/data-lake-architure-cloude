import { useTranslation } from 'react-i18next';
import {
  Modal,
  Field,
  Textarea,
  SelectField,
  Button,
} from '@/components';
import { useFormZod, useToast } from '@/hooks';
import { silverTransformPayloadSchema } from '@/schemas';
import { useTransformMutation } from '@/services/queries';

type Values = {
  sourceTable: string;
  transformRule: string;
  mode: 'full' | 'incremental';
};

const INITIAL: Values = {
  sourceTable: '',
  transformRule: '',
  mode: 'incremental',
};

export interface TransformFormProps {
  open: boolean;
  table: string;
  onClose: () => void;
}

export function TransformForm({ open, table, onClose }: TransformFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const form = useFormZod<Values>(silverTransformPayloadSchema, INITIAL);
  const mut = useTransformMutation();

  async function handleSubmit(): Promise<void> {
    if (!form.validate()) return;
    try {
      await mut.mutateAsync({
        table,
        payload: {
          sourceTable: form.values.sourceTable,
          transformRule: form.values.transformRule,
          mode: form.values.mode,
        },
      });
      toast.success(t('transform.success'));
      handleClose();
    } catch (e) {
      toast.error(t('transform.error.submit'), e instanceof Error ? e.message : '');
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
      title={t('transform.title')}
      description={t('transform.description', { table })}
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
            {mut.isPending ? t('transform.submitting') : t('transform.submit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field
          label="Source table"
          required
          error={form.errors.sourceTable ?? undefined}
        >
          <Textarea
            value={form.values.sourceTable}
            onChange={(e) => form.setField('sourceTable', e.target.value)}
            placeholder="bronze.events"
          />
        </Field>
        <Field
          label="Transform rule"
          required
          error={form.errors.transformRule ?? undefined}
          hint={t('transform.hint')}
        >
          <Textarea
            value={form.values.transformRule}
            onChange={(e) => form.setField('transformRule', e.target.value)}
            rows={6}
            placeholder='SELECT id, name FROM {{source}} WHERE status = "active"'
            className="font-mono"
          />
        </Field>
        <Field label="Mode" required>
          <SelectField
            value={form.values.mode}
            onChange={(v) => form.setField('mode', v as Values['mode'])}
            options={[
              { value: 'incremental', label: 'incremental' },
              { value: 'full', label: 'full' },
            ]}
          />
        </Field>
      </div>
    </Modal>
  );
}