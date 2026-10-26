import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Drawer,
  Input,
  Select,
  Tag,
} from '@/components/common';
import { Field } from '@/components/form';
import {
  useConfSpecQuery,
  usePreflightMutation,
  useTriggerDAGMutation,
} from '@/services/queries';
import type {
  AirflowConfSpec,
  AirflowPreflightResult,
  EConfFieldType,
} from '@/types/entities';

export interface AirflowTriggerWizardProps {
  dagId: string | null;
  open: boolean;
  onClose: () => void;
  onTriggered?: (runId: string) => void;
}

/**
 * The DAG trigger wizard.
 *
 * MASTER PLAN §09.1: "Trigger Wizard and run logs; conf allowlist; paused
 * semantics". The wizard has three responsibilities:
 *
 *   1. it renders a **typed form** from the server's conf specification —
 *      the operator never types raw JSON, and the form can never offer a
 *      key the server would reject;
 *   2. it runs the **preflight** before enabling the trigger, and shows the
 *      server's verdict verbatim (`canTrigger` plus the individual checks);
 *   3. it states the **paused semantics** plainly: a paused DAG still
 *      accepts a manual run, it just will not be scheduled.
 *
 * The verdict is *never* re-derived on the client. The server decides.
 */
function confInitialValues(spec: AirflowConfSpec | undefined): Record<string, unknown> {
  if (!spec) return {};
  const values: Record<string, unknown> = {};
  for (const key of spec.keys) {
    const type = spec.types[key];
    if (type === 'boolean') values[key] = false;
    else if (type === 'number') values[key] = 0;
    else if (type === 'enum') values[key] = spec.options[key]?.[0] ?? '';
    else values[key] = '';
  }
  return values;
}

function severityVariant(severity: string): 'error' | 'warning' | 'info' | 'neutral' {
  if (severity === 'error') return 'error';
  if (severity === 'warning') return 'warning';
  if (severity === 'info') return 'info';
  return 'neutral';
}

function CheckList({ result }: { result: AirflowPreflightResult }) {
  const errors = result.checks.filter((check) => check.severity === 'error');
  const warnings = result.checks.filter((check) => check.severity === 'warning');
  const infos = result.checks.filter((check) => check.severity === 'info');

  return (
    <div className="flex flex-col gap-1.5">
      {[...errors, ...warnings, ...infos].map((check) => (
        <div
          key={check.id}
          className="flex items-start gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5"
        >
          <Tag size="sm" variant={severityVariant(check.severity)}>
            {check.severity}
          </Tag>
          <span className="text-[11px] leading-relaxed text-neutral-700 dark:text-neutral-300">
            {check.message}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AirflowTriggerWizard({
  dagId,
  open,
  onClose,
  onTriggered,
}: AirflowTriggerWizardProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [preflight, setPreflight] = useState<AirflowPreflightResult | null>(null);

  const specQuery = useConfSpecQuery(dagId ?? '');
  const preflightMut = usePreflightMutation();
  const triggerMut = useTriggerDAGMutation();

  const spec = specQuery.data;

  useEffect(() => {
    if (!open) {
      setValues({});
      setPreflight(null);
      return;
    }
    setValues(confInitialValues(spec));
    setPreflight(null);
  }, [open, spec]);

  const hasValues = useMemo(
    () =>
      Object.entries(values).filter(([, value]) => {
        if (typeof value === 'string') return value.trim() !== '';
        if (typeof value === 'number') return true;
        if (typeof value === 'boolean') return value;
        return true;
      }).length > 0,
    [values],
  );

  function renderField(key: string, type: EConfFieldType) {
    const label = spec?.descriptions[key] ?? key;
    const value = values[key];

    if (type === 'enum') {
      const options = spec?.options[key] ?? [];
      return (
        <Field key={key} label={key} hint={label}>
          <Select
            selectSize="sm"
            value={String(value ?? '')}
            options={options.map((option) => ({ value: option, label: option }))}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, [key]: event.target.value }))
            }
          />
        </Field>
      );
    }

    if (type === 'boolean') {
      return (
        <Field key={key} label={key} hint={label}>
          <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, [key]: event.target.checked }))
              }
            />
            {value === true ? 'true' : 'false'}
          </label>
        </Field>
      );
    }

    return (
      <Field key={key} label={key} hint={label}>
        <Input
          inputSize="sm"
          type={type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={(event) =>
            setValues((prev) => ({
              ...prev,
              [key]:
                type === 'number'
                  ? Number(event.target.value)
                  : event.target.value,
            }))
          }
        />
      </Field>
    );
  }

  function handlePreflight(): void {
    if (!dagId) return;
    preflightMut.mutate(
      { dagId, conf: values },
      {
        onSuccess: (result) => setPreflight(result),
      },
    );
  }

  function handleTrigger(): void {
    if (!dagId) return;
    triggerMut.mutate(
      { dagId, payload: { conf: values } },
      {
        onSuccess: (result) => {
          onTriggered?.(result.runId);
          onClose();
        },
      },
    );
  }

  const busy = preflightMut.isPending || triggerMut.isPending;

  return (
    <Drawer
      open={open && dagId !== null}
      onClose={onClose}
      size="lg"
      title={t('airflow.wizard.title', { dagId: dagId ?? '' })}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePreflight}
            disabled={busy || dagId === null}
          >
            {preflightMut.isPending ? t('common.loading') : t('airflow.wizard.preflight')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleTrigger}
            disabled={
              busy ||
              dagId === null ||
              preflight === null ||
              !preflight.canTrigger ||
              triggerMut.isError
            }
          >
            {triggerMut.isPending ? t('airflow.triggering') : t('airflow.trigger')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {specQuery.isError ? (
          <p className="text-xs text-red-500">{specQuery.error.message}</p>
        ) : null}

        {spec && spec.keys.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {t('airflow.wizard.parameters')}
            </h3>
            {spec.keys.map((key) => renderField(key, spec.types[key] ?? 'string'))}
          </section>
        ) : spec ? (
          <p className="text-xs text-neutral-500">{t('airflow.wizard.noParameters')}</p>
        ) : null}

        {spec && spec.affectedDatasets.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {t('airflow.wizard.datasets')}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {spec.affectedDatasets.map((dataset) => (
                <Tag
                  key={`${dataset.layer}.${dataset.database}.${dataset.table}`}
                  size="sm"
                  variant="info"
                >
                  {dataset.layer} · {dataset.database}.{dataset.table}
                </Tag>
              ))}
            </div>
          </section>
        ) : null}

        {preflight ? (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {t('airflow.wizard.preflightResult')}
              </h3>
              <Tag size="sm" variant={preflight.canTrigger ? 'success' : 'error'}>
                {preflight.canTrigger
                  ? t('airflow.wizard.canTrigger')
                  : t('airflow.wizard.cannotTrigger')}
              </Tag>
            </div>
            <CheckList result={preflight} />
          </section>
        ) : hasValues ? (
          <p className="text-[11px] text-neutral-500">
            {t('airflow.wizard.preflightHint')}
          </p>
        ) : null}

        {triggerMut.isError ? (
          <p className="text-xs text-red-500">{triggerMut.error.message}</p>
        ) : null}
      </div>
    </Drawer>
  );
}
