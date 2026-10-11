import React from 'react';
import { AppIcon, type AppIconName } from './AppIcon';
import { useTranslation } from '../../utils/i18n';

export type AttendanceChoiceValue =
  | 'present'
  | 'late'
  | 'absent_charged'
  | 'absent_free'
  | 'cancelled';

export interface AttendanceOptionConfig {
  value: AttendanceChoiceValue;
  labelEn: string;
  labelAr: string;
  subEn?: string;
  subAr?: string;
  icon: AppIconName;
}

export const ATTENDANCE_CHOICE_CONFIGS: AttendanceOptionConfig[] = [
  {
    value: 'present',
    labelEn: 'Present',
    labelAr: 'حاضر',
    subEn: 'Consumes credit',
    subAr: 'تستهلك رصيد',
    icon: 'check',
  },
  {
    value: 'late',
    labelEn: 'Late',
    labelAr: 'متأخر',
    subEn: 'Attended late',
    subAr: 'حضر متأخراً',
    icon: 'clock',
  },
  {
    value: 'absent_charged',
    labelEn: 'Absent (Charged)',
    labelAr: 'غائب (محسوبة)',
    subEn: 'Consumes credit / due',
    subAr: 'تستهلك رصيد / مستحقة',
    icon: 'warning',
  },
  {
    value: 'absent_free',
    labelEn: 'Absent (Free)',
    labelAr: 'غائب (غير محسوبة)',
    subEn: 'Exempt / no charge',
    subAr: 'معفى / بدون خصم',
    icon: 'info',
  },
  {
    value: 'cancelled',
    labelEn: 'Cancelled',
    labelAr: 'حصة ملغاة',
    subEn: 'Class cancelled',
    subAr: 'تم إلغاء الحصة',
    icon: 'close',
  },
];

export interface AttendanceChoiceTilesProps {
  value: AttendanceChoiceValue;
  onChange: (val: AttendanceChoiceValue) => void;
  options?: AttendanceChoiceValue[];
  disabled?: boolean;
  className?: string;
}

export const AttendanceChoiceTiles: React.FC<AttendanceChoiceTilesProps> = ({
  value,
  onChange,
  options = ['present', 'late', 'absent_charged', 'absent_free', 'cancelled'],
  disabled = false,
  className = '',
}) => {
  const { language } = useTranslation();
  const isEn = language.startsWith('en');

  const filteredOptions = ATTENDANCE_CHOICE_CONFIGS.filter((cfg) =>
    options.includes(cfg.value)
  );

  return (
    <div className={`grid grid-cols-2 gap-2.5 ${className}`}>
      {filteredOptions.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`p-3 rounded-[18px] transition-all flex items-center justify-between gap-2.5 text-start cursor-pointer active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed ${
              isSelected
                ? 'bg-mint border-2 border-navy text-navy font-bold shadow-xs'
                : 'bg-mint-soft border border-line text-navy hover:bg-mint/60'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-navy text-white' : 'bg-page text-navy'
                }`}
              >
                <AppIcon name={opt.icon} size={16} weight={isSelected ? 'bold' : 'regular'} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold block truncate leading-tight">
                  {isEn ? opt.labelEn : opt.labelAr}
                </span>
                {(opt.subEn || opt.subAr) && (
                  <span className="text-[10px] text-slate block truncate mt-0.5 font-medium leading-tight">
                    {isEn ? opt.subEn : opt.subAr}
                  </span>
                )}
              </div>
            </div>

            {/* Check pop-in badge when selected */}
            {isSelected && (
              <span className="w-5 h-5 rounded-full bg-navy text-white flex items-center justify-center animate-pop-in shrink-0">
                <AppIcon name="check" size={12} weight="bold" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default AttendanceChoiceTiles;
