import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Field, Button } from '@/components';
import { RulePicker } from '@/components/dq';
import { useToast } from '@/hooks';
import { useDQRulesQuery, useRunDQSuiteMutation } from '@/services/queries';
import { getErrorMessage } from '@/services/api';

const MAX_RULES = 200;

export interface DQSuiteFormProps {
  open: boolean;
  onClose: () => void;
}

export function DQSuiteForm({ open, onClose }: DQSuiteFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState<ReadonlyArray<string>>([]);
  const rulesQuery = useDQRulesQuery();
  const mutation = useRunDQSuiteMutation();

  function close(): void {
    setSelectedIds([]);
    onClose();
  }

  async function submit(): Promise<void> {
    if (selectedIds.length === 0) {
      toast.error(t('dq.error.noRulesSelected'));
      return;
    }
    if (selectedIds.length > MAX_RULES) {
      toast.error(t('dq.error.tooManyRules', { max: MAX_RULES }));
      return;
    }
    try {
      const result = await mutation.mutateAsync({ ruleIds: [...selectedIds] });
      toast.success(t('dq.suiteStarted', { runId: result.runId }));
      close();
    } catch (error) {
      toast.error(t('dq.error.suite'), getErrorMessage(error));
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={t('dq.suiteTitle')}
      description={t('dq.suiteDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={mutation.isPending || selectedIds.length === 0}
            onClick={() => void submit()}
          >
            {t(mutation.isPending ? 'dq.running' : 'dq.runSuite')}
          </Button>
        </>
      }
    >
      <Field label={t('labels.rule_ids')} hint={t('dq.hint.ruleIds')}>
        <RulePicker
          rules={rulesQuery.data}
          isLoading={rulesQuery.isLoading}
          isError={rulesQuery.isError}
          error={rulesQuery.error}
          onRetry={() => void rulesQuery.refetch()}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
        />
      </Field>
    </Modal>
  );
}
