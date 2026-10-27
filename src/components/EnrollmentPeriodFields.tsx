import React from 'react';
import { VacationPeriod } from '../types';
import { useTranslation } from '../utils/i18n';
import { validateEnrollmentPeriod } from '../utils/schedule';
import { AppIcon } from './ui/AppIcon';

export interface EnrollmentPeriodFormValue {
  startDate?: string;
  endDate?: string;
  vacationPeriods: VacationPeriod[];
}

interface EnrollmentPeriodFieldsProps {
  value: EnrollmentPeriodFormValue;
  onChange: (next: EnrollmentPeriodFormValue) => void;
  title?: string;
  compact?: boolean;
  externalError?: string | null;
}

export const EnrollmentPeriodFields: React.FC<EnrollmentPeriodFieldsProps> = ({
  value,
  onChange,
  title,
  compact = false,
  externalError,
}) => {
  const { t, language } = useTranslation();

  const validation = validateEnrollmentPeriod(value, language);
  const startDate = value.startDate || '';
  const endDate = value.endDate || '';
  const vacations = Array.isArray(value.vacationPeriods) ? value.vacationPeriods : [];

  const handleStartDateChange = (nextStart: string) => {
    onChange({
      ...value,
      startDate: nextStart || undefined,
    });
  };

  const handleEndDateChange = (nextEnd: string) => {
    onChange({
      ...value,
      endDate: nextEnd || undefined,
    });
  };

  const handleAddVacation = () => {
    const newId = `vac_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    onChange({
      ...value,
      vacationPeriods: [
        ...vacations,
        {
          id: newId,
          startDate: '',
          endDate: '',
          reason: '',
        },
      ],
    });
  };

  const handleUpdateVacation = (id: string, patch: Partial<VacationPeriod>) => {
    onChange({
      ...value,
      vacationPeriods: vacations.map((vp) => (vp.id === id ? { ...vp, ...patch } : vp)),
    });
  };

  const handleRemoveVacation = (id: string) => {
    onChange({
      ...value,
      vacationPeriods: vacations.filter((vp) => vp.id !== id),
    });
  };

  return (
    <div
      className={
        compact
          ? 'space-y-3 pt-2.5 border-t border-line text-xs text-navy'
          : 'p-4 rounded-2xl bg-page border border-line space-y-3.5 shadow-2xs text-xs text-navy'
      }
    >
      {title !== '' && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs sm:text-sm font-black text-navy flex items-center gap-2">
            <AppIcon name="calendarRange" size={14} className="text-navy" />
            <span>{title || t('enrollmentPeriodSectionTitle')}</span>
          </span>
        </div>
      )}

      {/* Start & Optional End Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="field-label mb-0">{t('lessonStartDate')}</label>
            {startDate && (
              <button
                type="button"
                onClick={() => handleStartDateChange('')}
                className="text-[10px] font-bold text-slate hover:text-coral transition-colors cursor-pointer"
              >
                {t('clear')}
              </button>
            )}
          </div>
          <input
            type="date"
            dir="ltr"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="classy-input text-start"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="field-label mb-0">{t('lessonEndDateOptional')}</label>
            {endDate && (
              <button
                type="button"
                onClick={() => handleEndDateChange('')}
                className="text-[10px] font-bold text-slate hover:text-coral transition-colors cursor-pointer"
              >
                {t('clear')}
              </button>
            )}
          </div>
          <input
            type="date"
            dir="ltr"
            min={startDate || undefined}
            value={endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            className="classy-input text-start"
          />
        </div>
      </div>

      {/* Vacations & Suspension Periods */}
      <div className="space-y-2 pt-2 border-t border-line">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-navy flex items-center gap-1.5">
            <AppIcon name="calendar" size={13} className="text-slate" />
            <span>{t('vacationsAndSuspensions')}</span>
          </span>
          <button
            type="button"
            onClick={handleAddVacation}
            className="px-2.5 py-1 rounded-xl bg-mint-soft hover:bg-mint text-navy border border-line font-black text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <AppIcon name="plus" size={12} weight="bold" />
            <span>{t('addVacation')}</span>
          </button>
        </div>

        {vacations.length > 0 && (
          <div className="space-y-2">
            {vacations.map((vp) => (
              <div
                key={vp.id}
                className="p-2.5 rounded-2xl bg-mist border border-line space-y-2"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate mb-1">
                      {t('vacationStartDate')}
                    </label>
                    <input
                      type="date"
                      dir="ltr"
                      value={vp.startDate || ''}
                      onChange={(e) =>
                        handleUpdateVacation(vp.id, { startDate: e.target.value })
                      }
                      className="classy-input bg-page text-start"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate mb-1">
                      {t('vacationEndDate')}
                    </label>
                    <input
                      type="date"
                      dir="ltr"
                      min={vp.startDate || undefined}
                      value={vp.endDate || ''}
                      onChange={(e) =>
                        handleUpdateVacation(vp.id, { endDate: e.target.value })
                      }
                      className="classy-input bg-page text-start"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={t('vacationReasonOptional')}
                    value={vp.reason || ''}
                    onChange={(e) =>
                      handleUpdateVacation(vp.id, { reason: e.target.value })
                    }
                    className="classy-input bg-page flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveVacation(vp.id)}
                    className="p-2 rounded-xl bg-page hover:bg-coral-soft text-navy hover:text-coral border border-line transition-colors cursor-pointer shrink-0"
                    title={t('delete')}
                  >
                    <AppIcon name="trash" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation Errors & Overlap Warnings */}
      {(externalError || validation.errors.length > 0) && (
        <div className="p-2.5 rounded-xl bg-coral-soft border border-coral/30 text-coral text-[11px] font-bold flex items-start gap-1.5">
          <AppIcon name="warningCircle" size={14} className="shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {externalError ? (
              <p>{externalError}</p>
            ) : (
              validation.errors.map((err, idx) => <p key={idx}>{err}</p>)
            )}
          </div>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300/60 text-amber-900 text-[11px] font-bold flex items-start gap-1.5">
          <AppIcon name="warning" size={14} className="shrink-0 mt-0.5 text-amber-600" />
          <div className="space-y-0.5">
            {validation.warnings.map((warn, idx) => (
              <p key={idx}>{warn}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export function sanitizePeriodForPersistence(period: EnrollmentPeriodFormValue): {
  startDate?: string;
  endDate?: string;
  vacationPeriods: VacationPeriod[];
} {
  const startDate = period.startDate?.trim() || undefined;
  const endDate = period.endDate?.trim() || undefined;
  const vacationPeriods: VacationPeriod[] = (period.vacationPeriods || [])
    .filter((vp) => vp && vp.startDate?.trim() && vp.endDate?.trim())
    .map((vp) => ({
      id: vp.id || `vac_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      startDate: vp.startDate.trim(),
      endDate: vp.endDate.trim(),
      ...(vp.reason?.trim() ? { reason: vp.reason.trim() } : {}),
    }));

  return {
    startDate,
    endDate,
    vacationPeriods,
  };
}
