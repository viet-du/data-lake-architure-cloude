import { useTranslation } from 'react-i18next';

export interface SkipLinkProps {
  targetId?: string;
  className?: string;
}

export function SkipLink({ targetId = 'main-content', className }: SkipLinkProps) {
  const { t } = useTranslation();
  return (
    <a href={`#${targetId}`} className={`skip-link ${className ?? ''}`.trim()}>
      {t('a11y.skipToContent')}
    </a>
  );
}
