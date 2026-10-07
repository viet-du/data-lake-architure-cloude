import { useTranslation } from 'react-i18next';
import { Button, EmptyState } from '@/components';
import { getErrorMessage } from '@/services/api';

export interface ScreenErrorProps {
  error: unknown;
  onRetry?: (() => void) | undefined;
  compact?: boolean;
}

export function ScreenError({ error, onRetry, compact = false }: ScreenErrorProps) {
  const { t } = useTranslation();
  return (
    <EmptyState
      compact={compact}
      title={t('common.error')}
      description={getErrorMessage(error)}
      action={
        onRetry !== undefined ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        ) : undefined
      }
    />
  );
}
