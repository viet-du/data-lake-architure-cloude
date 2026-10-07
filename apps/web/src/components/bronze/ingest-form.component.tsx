import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Field,
  SelectField,
  Textarea,
  Button,
  Tag,
} from '@/components';
import { useFormZod } from '@/hooks';
import {
  ingestJsonPayloadSchema,
  ingestCsvPayloadSchema,
  ingestStreamPayloadSchema,
} from '@/schemas';
import {
  useIngestJsonMutation,
  useIngestCsvMutation,
  useIngestStreamMutation,
} from '@/services/queries';
import { useToast } from '@/hooks';

type Mode = 'json' | 'csv' | 'stream';

interface BaseValues {
  database: string;
  table: string;
}

interface JsonValues extends BaseValues {
  data: string;
  mode: 'append' | 'overwrite' | 'merge';
}

interface CsvValues extends BaseValues {
  fileUrl: string;
  delimiter: string;
  hasHeader: boolean;
  mode: 'append' | 'overwrite';
}

interface StreamValues extends BaseValues {
  topic: string;
  checkpointLocation: string;
}

const JSON_DEFAULT: JsonValues = {
  database: '',
  table: '',
  data: '[]',
  mode: 'append',
};

const CSV_DEFAULT: CsvValues = {
  database: '',
  table: '',
  fileUrl: '',
  delimiter: ',',
  hasHeader: true,
  mode: 'append',
};

const STREAM_DEFAULT: StreamValues = {
  database: '',
  table: '',
  topic: '',
  checkpointLocation: '',
};

export interface IngestFormProps {
  open: boolean;
  onClose: () => void;
}

export function IngestForm({ open, onClose }: IngestFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('json');

  const jsonForm = useFormZod(ingestJsonPayloadSchema, JSON_DEFAULT);
  const csvForm = useFormZod(ingestCsvPayloadSchema, CSV_DEFAULT);
  const streamForm = useFormZod(ingestStreamPayloadSchema, STREAM_DEFAULT);

  const jsonMut = useIngestJsonMutation();
  const csvMut = useIngestCsvMutation();
  const streamMut = useIngestStreamMutation();

  const submitting =
    jsonMut.isPending || csvMut.isPending || streamMut.isPending;

  async function handleSubmit(): Promise<void> {
    if (mode === 'json') {
      if (!jsonForm.validate()) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonForm.values.data);
      } catch {
        toast.error(t('ingest.errors.invalidJson'));
        return;
      }
      try {
        await jsonMut.mutateAsync({
          database: jsonForm.values.database,
          table: jsonForm.values.table,
          data: Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [],
          mode: jsonForm.values.mode,
        });
        toast.success(t('ingest.success.json'));
        handleClose();
      } catch (e) {
        toast.error(t('ingest.error.submit'), e instanceof Error ? e.message : '');
      }
      return;
    }
    if (mode === 'csv') {
      if (!csvForm.validate()) return;
      try {
        await csvMut.mutateAsync({
          database: csvForm.values.database,
          table: csvForm.values.table,
          fileUrl: csvForm.values.fileUrl,
          delimiter: csvForm.values.delimiter,
          hasHeader: csvForm.values.hasHeader,
          mode: csvForm.values.mode,
        });
        toast.success(t('ingest.success.csv'));
        handleClose();
      } catch (e) {
        toast.error(t('ingest.error.submit'), e instanceof Error ? e.message : '');
      }
      return;
    }
    if (!streamForm.validate()) return;
    try {
        await streamMut.mutateAsync({
          topic: streamForm.values.topic,
          payload: {
            database: streamForm.values.database,
            table: streamForm.values.table,
            ...(streamForm.values.checkpointLocation !== ''
              ? { checkpointLocation: streamForm.values.checkpointLocation }
              : {}),
          },
        });
      toast.success(t('ingest.success.stream'));
      handleClose();
    } catch (e) {
      toast.error(t('ingest.error.submit'), e instanceof Error ? e.message : '');
    }
  }

  function handleClose(): void {
    jsonForm.reset();
    csvForm.reset();
    streamForm.reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('ingest.title')}
      description={t('ingest.description')}
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
            disabled={submitting}
          >
            {submitting ? t('ingest.submitting') : t('ingest.submit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {(['json', 'csv', 'stream'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === m
                  ? 'bg-primary-500/20 text-primary-600 dark:text-primary-300'
                  : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              {t(`ingest.modes.${m}`)}
            </button>
          ))}
        </div>

        {mode === 'json' ? (
          <div className="flex flex-col gap-3">
            <Field label="Database" htmlFor="ingest-db" required error={jsonForm.errors.database}>
              <Textarea
                id="ingest-db"
                value={jsonForm.values.database}
                onChange={(e) => jsonForm.setField('database', e.target.value)}
                placeholder="bronze"
              />
            </Field>
            <Field label="Table" htmlFor="ingest-table" required error={jsonForm.errors.table}>
              <Textarea
                id="ingest-table"
                value={jsonForm.values.table}
                onChange={(e) => jsonForm.setField('table', e.target.value)}
                placeholder="events"
              />
            </Field>
            <Field label="Mode" required>
              <SelectField
                value={jsonForm.values.mode}
                onChange={(v) => jsonForm.setField('mode', v as JsonValues['mode'])}
                options={[
                  { value: 'append', label: 'append' },
                  { value: 'overwrite', label: 'overwrite' },
                  { value: 'merge', label: 'merge' },
                ]}
              />
            </Field>
            <Field label="Data (JSON array)" required error={jsonForm.errors.data}>
              <Textarea
                value={jsonForm.values.data}
                onChange={(e) => jsonForm.setField('data', e.target.value)}
                rows={6}
                placeholder='[{"id": 1, "name": "foo"}]'
                className="font-mono"
              />
            </Field>
          </div>
        ) : null}

        {mode === 'csv' ? (
          <div className="flex flex-col gap-3">
            <Field label="Database" htmlFor="csv-db" required error={csvForm.errors.database}>
              <Textarea
                id="csv-db"
                value={csvForm.values.database}
                onChange={(e) => csvForm.setField('database', e.target.value)}
              />
            </Field>
            <Field label="Table" htmlFor="csv-table" required error={csvForm.errors.table}>
              <Textarea
                id="csv-table"
                value={csvForm.values.table}
                onChange={(e) => csvForm.setField('table', e.target.value)}
              />
            </Field>
            <Field label="File URL" htmlFor="csv-url" required error={csvForm.errors.fileUrl}>
              <Textarea
                id="csv-url"
                value={csvForm.values.fileUrl}
                onChange={(e) => csvForm.setField('fileUrl', e.target.value)}
                placeholder="https://..."
              />
            </Field>
            <Field label="Delimiter" hint={t('ingest.hints.delimiter')}>
              <Textarea
                value={csvForm.values.delimiter}
                onChange={(e) => csvForm.setField('delimiter', e.target.value.slice(0, 1))}
                placeholder=","
              />
            </Field>
            <Field label="Mode" required>
              <SelectField
                value={csvForm.values.mode}
                onChange={(v) => csvForm.setField('mode', v as CsvValues['mode'])}
                options={[
                  { value: 'append', label: 'append' },
                  { value: 'overwrite', label: 'overwrite' },
                ]}
              />
            </Field>
          </div>
        ) : null}

        {mode === 'stream' ? (
          <div className="flex flex-col gap-3">
            <Field label="Topic" required error={streamForm.errors.table}>
              <Textarea
                value={streamForm.values.topic}
                onChange={(e) => streamForm.setField('topic', e.target.value)}
                placeholder="events.raw"
              />
            </Field>
            <Field label="Database" required error={streamForm.errors.database}>
              <Textarea
                value={streamForm.values.database}
                onChange={(e) => streamForm.setField('database', e.target.value)}
              />
            </Field>
            <Field label="Table" required error={streamForm.errors.table}>
              <Textarea
                value={streamForm.values.table}
                onChange={(e) => streamForm.setField('table', e.target.value)}
              />
            </Field>
            <Field label="Checkpoint location" hint={t('ingest.hints.checkpoint')}>
              <Textarea
                value={streamForm.values.checkpointLocation}
                onChange={(e) => streamForm.setField('checkpointLocation', e.target.value)}
                placeholder="s3://bucket/checkpoint"
              />
            </Field>
          </div>
        ) : null}

        <div className="rounded-lg border border-white/5 bg-white/5 p-2 text-[10px] text-neutral-500">
          <Tag size="sm" variant="info">
            {t(`ingest.modes.${mode}`)}
          </Tag>
          <span className="ml-2">{t('ingest.warning')}</span>
        </div>
      </div>
    </Modal>
  );
}
