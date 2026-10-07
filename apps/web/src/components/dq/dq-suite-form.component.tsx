import { useTranslation } from 'react-i18next';
import { Modal, Field, Textarea, NumberField, Button } from '@/components';
import { useFormZod, useToast } from '@/hooks';
import { runSuitePayloadSchema } from '@/schemas';
import { useRunDQSuiteMutation } from '@/services/queries';

type Values = {
  ruleIdsText: string;
  tablesText: string;
  parallel: number | '';
};

const INITIAL: Values = {
  ruleIdsText: '',
  tablesText: '',
  parallel: 4,
};

export interface DQSuiteFormProps {
  open: boolean;
  onClose: () => void;
}

function parseList(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function DQSuiteForm({ open, onClose }: DQSuiteFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const form = useFormZod<Values>(runSuitePayloadSchema, INITIAL);
  const mut = useRunDQSuiteMutation();

  function buildPayload(): { ruleIds?: string[]; tables?: string[]; parallel?: number } {
    const out: { ruleIds?: string[]; tables?: string[]; parallel?: number } = {};
    const ruleIds = parseList(form.values.ruleIdsText);
    const tables = parseList(form.values.tablesText);
    if (ruleIds.length > 0) out.ruleIds = ruleIds;
    if (tables.length > 0) out.tables = tables;
    if (form.values.parallel !== '') out.parallel = form.values.parallel;
    return out;
  }

  async function handleSubmit(): Promise<void> {
    if (!form.validate()) return;
    try {
      const result = await mut.mutateAsync(buildPayload());
      toast.success(t('dq.suiteStarted', { runId: result.runId.slice(0, 12) }));
      handleClose();
    } catch (e) {
      toast.error(t('dq.error.suite'), e instanceof Error ? e.message : '');
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
      title={t('dq.suiteTitle')}
      description={t('dq.suiteDescription')}
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
            {mut.isPending ? t('dq.running') : t('dq.runSuite')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Rule IDs" hint={t('dq.hint.ruleIds')}>
          <Textarea
            value={form.values.ruleIdsText}
            onChange={(e) => form.setField('ruleIdsText', e.target.value)}
            placeholder="rule-001, rule-002"
            rows={3}
            className="font-mono"
          />
        </Field>
        <Field label="Tables" hint={t('dq.hint.tables')}>
          <Textarea
            value={form.values.tablesText}
            onChange={(e) => form.setField('tablesText', e.target.value)}
            placeholder="bronze.orders, silver.customers"
            rows={3}
            className="font-mono"
          />
        </Field>
        <Field label="Parallel" hint={t('dq.hint.parallel')}>
          <NumberField
            value={form.values.parallel}
            onChange={(v) => form.setField('parallel', v)}
            min={1}
            max={32}
          />
        </Field>
      </div>
    </Modal>
  );
}