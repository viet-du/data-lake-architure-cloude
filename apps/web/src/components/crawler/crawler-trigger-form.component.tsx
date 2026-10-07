import { useTranslation } from 'react-i18next';
import {
  Modal,
  Field,
  Textarea,
  NumberField,
  Button,
  Tag,
} from '@/components';
import { useFormZod, useToast } from '@/hooks';
import { runJobPayloadSchema } from '@/schemas';
import { useRunCrawlerMutation } from '@/services/queries';

type Values = {
  pages: number | '';
  categoriesText: string;
  asyncRun: boolean;
};

const INITIAL: Values = {
  pages: 10,
  categoriesText: '',
  asyncRun: false,
};

export interface CrawlerTriggerFormProps {
  open: boolean;
  name: string;
  onClose: () => void;
}

export function CrawlerTriggerForm({ open, name, onClose }: CrawlerTriggerFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const form = useFormZod<Values>(runJobPayloadSchema, INITIAL);
  const mut = useRunCrawlerMutation();

  function buildPayload(): {
    pages?: number;
    categories?: string[];
    async?: boolean;
  } {
    const out: { pages?: number; categories?: string[]; async?: boolean } = {};
    if (form.values.pages !== '') out.pages = form.values.pages;
    const cats = form.values.categoriesText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (cats.length > 0) out.categories = cats;
    if (form.values.asyncRun) out.async = true;
    return out;
  }

  async function handleSubmit(): Promise<void> {
    if (!form.validate()) return;
    try {
      const result = await mut.mutateAsync({
        name,
        payload: buildPayload(),
      });
      toast.success(t('crawler.runStarted', { runId: result.runId.slice(0, 8) }));
      handleClose();
    } catch (e) {
      toast.error(t('crawler.error.run'), e instanceof Error ? e.message : '');
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
      title={t('crawler.triggerTitle')}
      description={t('crawler.triggerDescription', { name })}
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
            {mut.isPending ? t('crawler.running') : t('crawler.run')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field
          label="Pages"
          hint={t('crawler.hint.pages')}
        >
          <NumberField
            value={form.values.pages}
            onChange={(v) => form.setField('pages', v)}
            min={1}
            max={1000}
          />
        </Field>
        <Field
          label="Categories"
          hint={t('crawler.hint.categories')}
        >
          <Textarea
            value={form.values.categoriesText}
            onChange={(e) => form.setField('categoriesText', e.target.value)}
            placeholder="electronics, books"
            rows={3}
            className="font-mono"
          />
        </Field>
        <div className="flex items-center gap-2">
          <input
            id="crawler-async"
            type="checkbox"
            checked={form.values.asyncRun}
            onChange={(e) => form.setField('asyncRun', e.target.checked)}
            className="h-4 w-4 rounded border-white/10 bg-white/5"
          />
          <label
            htmlFor="crawler-async"
            className="text-xs font-medium text-neutral-700 dark:text-neutral-300"
          >
            {t('crawler.asyncRun')}
          </label>
          <Tag size="sm" variant="info">
            {t('crawler.hint.async')}
          </Tag>
        </div>
      </div>
    </Modal>
  );
}