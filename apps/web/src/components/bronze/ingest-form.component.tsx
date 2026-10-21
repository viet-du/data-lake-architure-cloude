import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Modal, Field, Input, Select, Button, ScreenError } from '@/components';
import { useIngestCsvMutation, useIngestJsonMutation, useIngestStreamMutation } from '@/services/queries';
import { useToast } from '@/hooks';

export interface IngestFormProps { open: boolean; onClose: () => void }
const identifier = z.string().min(1).max(120).regex(/^[a-z0-9_]+$/);
export function IngestForm({ open, onClose }: IngestFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [mode, setMode] = useState('json');
  const [database, setDatabase] = useState('');
  const [table, setTable] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const json = useIngestJsonMutation();
  const csv = useIngestCsvMutation();
  const stream = useIngestStreamMutation();
  const pending = json.isPending || csv.isPending || stream.isPending;
  async function submit() {
    setError(null);
    try {
      const body = z.object({ database: z.string().min(1).max(64), table: identifier, source: z.string().min(1).max(2048) }).parse({ database, table, source });
      if (mode === 'stream') await stream.mutateAsync({ topic: source, payload: { database, table } });
      else if (mode === 'csv') await csv.mutateAsync(body);
      else await json.mutateAsync(body);
      toast.success(t('ingest.submitted'));
      onClose();
    } catch (e) { setError(e instanceof Error ? e : new Error(String(e))); }
  }
  return <Modal open={open} onClose={onClose} title={t('ingest.title')} description={t('ingest.description')} footer={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" disabled={pending} onClick={() => void submit()}>{t(pending ? 'ingest.submitting' : 'ingest.submit')}</Button></>}>
    <div className="flex flex-col gap-3">
      <Field label={t('form.format')}><Select value={mode} onChange={(e) => setMode(e.target.value)} options={[{value:'json',label:'JSON / JSONL'},{value:'csv',label:'CSV'},{value:'stream',label:'Kafka'}]} /></Field>
      <Field label={t('form.database')}><Input value={database} onChange={(e) => setDatabase(e.target.value)} /></Field>
      <Field label={t('form.table')}><Input value={table} onChange={(e) => setTable(e.target.value)} /></Field>
      <Field label={t(mode === 'stream' ? 'form.topic' : 'form.source')}><Input value={source} onChange={(e) => setSource(e.target.value)} /></Field>
      {error ? <ScreenError error={error} compact /> : null}
    </div>
  </Modal>;
}
