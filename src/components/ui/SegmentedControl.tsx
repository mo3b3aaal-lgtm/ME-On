import React from 'react';
import { useTranslation } from '../../utils/i18n';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  id?: string;
  title?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  itemClassName?: string;
  ariaLabel?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className = '',
  itemClassName = '',
  ariaLabel,
}: SegmentedControlProps<T>) {
  const { isRTL } = useTranslation();
  const count = Math.max(options.length, 1);
  const rawIndex = options.findIndex((opt) => opt.value === value);
  const activeIndex = rawIndex >= 0 ? rawIndex : 0;
  const translateSign = isRTL ? -1 : 1;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`segmented-control grid ${className}`}
      style={{
        gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
      }}
    >
      <span
        aria-hidden="true"
        className="segmented-thumb"
        style={{
          width: `calc((100% - 8px) / ${count})`,
          transform: `translateX(${translateSign * activeIndex * 100}%)`,
        }}
      />
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            id={opt.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={opt.disabled}
            title={opt.title}
            onClick={() => {
              if (!opt.disabled) onChange(opt.value);
            }}
            className={`segmented-item ${isActive ? 'segmented-item-active' : 'segmented-item-inactive'} ${itemClassName}`}
          >
            {opt.icon && <span className="inline-flex items-center shrink-0">{opt.icon}</span>}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
