import { ICONS, type EIconName, type EIconTone, type IconComponentProps } from '@/assets';
import { cn } from '@/theme';

export type { EIconName, EIconTone, IconComponentProps };

const TONE_CLASS: Readonly<Record<EIconTone, string>> = {
  colored: '',
  mono: 'brightness-0 invert',
};

export function Icon({ name, size = 24, className, alt, tone = 'colored' }: IconComponentProps) {
  return (
    <img
      src={ICONS[name as EIconName]}
      alt={alt ?? ''}
      aria-hidden={alt === undefined}
      className={cn('object-contain select-none', TONE_CLASS[tone], className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}