import { Input, type EInputSize } from '@/components';

export interface NumberFieldProps {
  value: number | '';
  onChange: (value: number | '') => void;
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  placeholder?: string | undefined;
  size?: EInputSize | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  size = 'md',
  className,
  disabled,
}: NumberFieldProps) {
  return (
    <Input
      type="number"
      inputSize={size}
      value={value === '' ? '' : value}
      min={min ?? undefined}
      max={max ?? undefined}
      step={step ?? undefined}
      placeholder={placeholder ?? undefined}
      disabled={disabled ?? undefined}
      className={className ?? undefined}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange('');
          return;
        }
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) onChange(parsed);
      }}
    />
  );
}