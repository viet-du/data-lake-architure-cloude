import { Select, type ESelectSize, type SelectOption } from '@/components';

export interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<SelectOption>;
  size?: ESelectSize;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SelectField({
  value,
  onChange,
  options,
  size = 'md',
  placeholder,
  className,
  disabled,
}: SelectFieldProps) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={options}
      selectSize={size}
      placeholder={placeholder ?? undefined}
      disabled={disabled ?? undefined}
      className={className ?? undefined}
    />
  );
}

export type { SelectOption };