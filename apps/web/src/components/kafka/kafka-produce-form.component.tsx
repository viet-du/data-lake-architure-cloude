import { useTranslation } from 'react-i18next';
import { Modal, Field, Input, Textarea, NumberField, Button } from '@/components';
import { useFormZod, useToast } from '@/hooks';
import { kafkaProducePayloadSchema } from '@/schemas';
import { useProduceMutation } from '@/services/queries';

type Values = {
  key: string;
  value: string;
  headersText: string;
  partition: number | '';
};

const INITIAL: Values = {
  key: '',
  value: '',
  headersText: '',
  partition: '',
};

export interface KafkaProduceFormProps {
  open: boolean;
  topic: string;
  onClose: () => void;
}

function parseHeaders(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  text
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes(':'))
    .forEach((line) => {
      const idx = line.indexOf(':');
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k.length > 0) out[k] = v;
    });
  return out;
}

export function KafkaProduceForm({ open, topic, onClose }: KafkaProduceFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const form = useFormZod<Values>(kafkaProducePayloadSchema, INITIAL);
  const mut = useProduceMutation();

  function buildPayload(): {
    key?: string;
    value: string;
    headers?: Record<string, string>;
    partition?: number;
  } {
    const out: {
      key?: string;
      value: string;
      headers?: Record<string, string>;
      partition?: number;
    } = { value: form.values.value };
    if (form.values.key.length > 0) out.key = form.values.key;
    const headers = parseHeaders(form.values.headersText);
    if (Object.keys(headers).length > 0) out.headers = headers;
    if (form.values.partition !== '') out.partition = form.values.partition;
    return out;
  }

  async function handleSubmit(): Promise<void> {
    if (!form.validate()) return;
    try {
      const result = await mut.mutateAsync({ topic, payload: buildPayload() });
      toast.success(t('kafka.produced', { offset: result.offset, partition: result.partition }));
      handleClose();
    } catch (e) {
      toast.error(t('kafka.error.produce'), e instanceof Error ? e.message : '');
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
      title={t('kafka.produceTitle')}
      description={t('kafka.produceDescription', { topic })}
      size="lg"
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
            {mut.isPending ? t('kafka.producing') : t('kafka.produce')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Key" hint={t('kafka.hint.key')}>
          <Input
            value={form.values.key}
            onChange={(e) => form.setField('key', e.target.value)}
            placeholder="user-123"
          />
        </Field>
        <Field label="Value" required hint={t('kafka.hint.value')}>
          <Textarea
            value={form.values.value}
            onChange={(e) => form.setField('value', e.target.value)}
            placeholder='{"event":"click"}'
            rows={6}
            className="font-mono"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Partition" hint={t('kafka.hint.partition')}>
            <NumberField
              value={form.values.partition}
              onChange={(v) => form.setField('partition', v)}
              min={0}
              max={1024}
            />
          </Field>
        </div>
        <Field label="Headers" hint={t('kafka.hint.headers')}>
          <Textarea
            value={form.values.headersText}
            onChange={(e) => form.setField('headersText', e.target.value)}
            placeholder={'source:web\nversion:1.0'}
            rows={3}
            className="font-mono"
          />
        </Field>
      </div>
    </Modal>
  );
}