import { useId } from 'react';
import { cn } from '../../contexts/ThemeContext';

export type ChoiceOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type BaseProps = {
  label?: string;
  helperText?: string;
  error?: string;
  options: ChoiceOption[];
  className?: string;
  required?: boolean;
  layout?: 'stack' | 'grid';
};

export function RadioGroup({
  label,
  helperText,
  error,
  options,
  value,
  onChange,
  className,
  required,
  layout = 'stack',
}: BaseProps & { value: string; onChange: (value: string) => void }) {
  const baseId = useId();
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <div className="text-sm font-semibold text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </div>
      )}
      <div className={cn(layout === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'flex flex-col gap-2')}>
        {options.map((opt) => {
          const id = `${baseId}-${opt.value}`;
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className={cn(
                'flex items-start gap-3 border rounded-lg px-3 py-2 cursor-pointer',
                'hover:border-gray-400',
                value === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white',
                opt.disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <input
                id={id}
                type="radio"
                name={baseId}
                className="mt-1"
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                disabled={opt.disabled}
              />
              <div className="min-w-0">
                <div className="text-sm text-gray-900">{opt.label}</div>
                {opt.description && <div className="text-xs text-gray-600 mt-0.5">{opt.description}</div>}
              </div>
            </label>
          );
        })}
      </div>
      {error && <div className="text-sm text-red-600 mt-1">{error}</div>}
      {!error && helperText && <div className="text-sm text-gray-500 mt-1">{helperText}</div>}
    </div>
  );
}

export function CheckboxGroup({
  label,
  helperText,
  error,
  options,
  value,
  onChange,
  className,
  required,
  layout = 'stack',
}: BaseProps & { value: string[]; onChange: (value: string[]) => void }) {
  const baseId = useId();
  const set = new Set(value);

  const toggle = (v: string) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(Array.from(next));
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <div className="text-sm font-semibold text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </div>
      )}
      <div className={cn(layout === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'flex flex-col gap-2')}>
        {options.map((opt) => {
          const id = `${baseId}-${opt.value}`;
          const checked = set.has(opt.value);
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className={cn(
                'flex items-start gap-3 border rounded-lg px-3 py-2 cursor-pointer',
                'hover:border-gray-400',
                checked ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white',
                opt.disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <input
                id={id}
                type="checkbox"
                className="mt-1"
                checked={checked}
                onChange={() => toggle(opt.value)}
                disabled={opt.disabled}
              />
              <div className="min-w-0">
                <div className="text-sm text-gray-900">{opt.label}</div>
                {opt.description && <div className="text-xs text-gray-600 mt-0.5">{opt.description}</div>}
              </div>
            </label>
          );
        })}
      </div>
      {error && <div className="text-sm text-red-600 mt-1">{error}</div>}
      {!error && helperText && <div className="text-sm text-gray-500 mt-1">{helperText}</div>}
    </div>
  );
}

