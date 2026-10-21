import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Modal, Field, Textarea, Button } from '@/components';
import { useFormZod, useToast } from '@/hooks';
import { useRunDQSuiteMutation } from '@/services/queries';

const valuesSchema = z.object({ ruleIdsText: z.string().trim().min(1) });
const ruleIdsSchema = z.array(z.string().min(1).max(120)).min(1).max(200);
const INITIAL = { ruleIdsText: '' };

export interface DQSuiteFormProps {
  open: boolean;
  onClose: () => void;
}

export function DQSuiteForm({ open, onClose }: DQSuiteFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const form = useFormZod(valuesSchema, INITIAL);
  const mutation = useRunDQSuiteMutation();

  function close(): void {
    form.reset();
    onClose();
  }

  async function submit(): Promise<void> {
    if (!form.validate()) return;
    try {
      const ruleIds = ruleIdsSchema.parse(form.values.ruleIdsText.split(/[,\n]/).map((id) => id.trim()).filter(Boolean));
      const result = await mutation.mutateAsync({ ruleIds });
      toast.success(t('dq.suiteStarted', { runId: result.runId }));
      close();
    } catch (error) {
      toast.error(t('dq.error.suite'), error instanceof Error ? error.message : '');
    }
  }

  return (
    <Modal open={open} onClose={close} title={t('dq.suiteTitle')} description={t('dq.suiteDescription')}
      footer={<><Button variant="ghost" onClick={close}>{t('common.cancel')}</Button><Button variant="primary" disabled={mutation.isPending} onClick={() => void submit()}>{t(mutation.isPending ? 'dq.running' : 'dq.runSuite')}</Button></>}>
      <Field label={t('labels.rule_ids')} hint={t('dq.hint.ruleIds')} error={form.errors.ruleIdsText}>
        <Textarea value={form.values.ruleIdsText} onChange={(event) => form.setField('ruleIdsText', event.target.value)} rows={3} />
      </Field>
    </Modal>
  );
}
