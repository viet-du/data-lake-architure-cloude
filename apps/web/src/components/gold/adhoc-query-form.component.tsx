import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Field,
  Textarea,
  NumberField,
  Button,
  QueryResult,
} from '@/components';
import { useFormZod, useToast } from '@/hooks';
import { adHocQueryParamsSchema } from '@/schemas';
import { useAdHocQuery } from '@/services/queries';

type Values = {
  sql: string;
  limit: number | '';
};

const INITIAL: Values = {
  sql: '',
  limit: 100,
};

export interface AdHocQueryFormProps {
  open: boolean;
  onClose: () => void;
}

export function AdHocQueryForm({ open, onClose }: AdHocQueryFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const form = useFormZod<Values>(adHocQueryParamsSchema, INITIAL);
  const [enabled, setEnabled] = useState(false);

  const queryParams: { sql: string; limit?: number } =
    form.values.sql === ''
      ? { sql: '' }
      : form.values.limit === ''
        ? { sql: form.values.sql }
        : { sql: form.values.sql, limit: form.values.limit };

  const query = useAdHocQuery(queryParams);

  function handleSubmit(): void {
    if (!form.validate()) return;
    if (form.values.sql.trim() === '') {
      toast.error(t('adhoc.errors.sqlRequired'));
      return;
    }
    setEnabled(true);
  }

  function handleClose(): void {
    form.reset();
    setEnabled(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('adhoc.title')}
      description={t('adhoc.description')}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={query.isFetching}
          >
            {query.isFetching ? t('adhoc.running') : t('adhoc.run')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field
          label="SQL"
          required
          error={form.errors.sql ?? undefined}
          hint={t('adhoc.hint')}
        >
          <Textarea
            value={form.values.sql}
            onChange={(e) => form.setField('sql', e.target.value)}
            rows={5}
            placeholder="SELECT category, SUM(amount) FROM silver.orders GROUP BY category"
            className="font-mono"
          />
        </Field>
        <Field label="Row limit">
          <NumberField
            value={form.values.limit}
            onChange={(v) => form.setField('limit', v)}
            min={1}
            max={1000}
          />
        </Field>
        {enabled ? (
          <div className="mt-2">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-neutral-500">
              {t('adhoc.result')}
            </p>
            <QueryResult
              columns={query.data?.columns ?? []}
              rows={query.data?.rows ?? []}
              totalRows={query.data?.totalRows ?? 0}
              executionMs={query.data?.executionMs}
              isLoading={query.isLoading}
              isError={query.isError}
              error={query.error}
              onRetry={() => void query.refetch()}
              maxRows={100}
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}