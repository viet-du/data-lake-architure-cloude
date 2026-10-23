import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Modal, Field, Input, Select, Button, ScreenError } from '@/components';
import { useAggregateMutation } from '@/services/queries';
import { useToast } from '@/hooks';

export interface AggregateFormProps { open: boolean; table: string; onClose: () => void; onResult?: () => void }
export function AggregateForm({ open, table, onClose, onResult }: AggregateFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const mutation = useAggregateMutation();
  const [source, setSource] = useState('');
  const [kind, setKind] = useState('full');
  const [error, setError] = useState<Error | null>(null);
  async function submit() {
    setError(null);
    try {
      const mode = z.enum(['full','incremental','refresh']).parse(kind);
      const sources = z.array(z.string().min(1).max(120).regex(/^[a-z0-9_]+$/)).min(1).max(20).parse(source.split(',').map((s) => s.trim()));
      await mutation.mutateAsync({ table, payload: { kind: mode, sourceTables: sources } });
      toast.success(t('aggregate.success'));
      onResult?.(); onClose();
    } catch (e) { setError(e instanceof Error ? e : new Error(String(e))); }
  }
  return <Modal open={open} onClose={onClose} title={t('aggregate.title')} description={t('aggregate.description', { table })} footer={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" disabled={mutation.isPending} onClick={() => void submit()}>{t('aggregate.submit')}</Button></>}>
    <div className="flex flex-col gap-3">
      <Field label={t('form.sourceTables')}><Input value={source} onChange={(e) => setSource(e.target.value)} /></Field>
      <Field label={t('form.mode')}><Select value={kind} onChange={(e) => setKind(e.target.value)} options={[{value:'full',label:t('form.full')},{value:'incremental',label:t('form.incremental')},{value:'refresh',label:t('common.refresh')}]} /></Field>
      {error ? <ScreenError error={error} compact /> : null}
    </div>
  </Modal>;
}
