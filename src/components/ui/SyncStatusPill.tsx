import React from 'react';
import { AppIcon } from './AppIcon';
import { useTranslation } from '../../utils/i18n';
import type { AutoSyncStatus } from '../../types';

export interface SyncStatusPillProps {
  isOnline: boolean;
  syncStatus?: AutoSyncStatus;
  lastSyncTime?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Sync/offline indicators: small slate pill; error state coral.
 */
export const SyncStatusPill: React.FC<SyncStatusPillProps> = ({
  isOnline,
  syncStatus = 'idle',
  lastSyncTime,
  className = '',
  onClick,
}) => {
  const { isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  const isError = syncStatus === 'error';
  const isOffline = !isOnline || syncStatus === 'offline_deferred';
  const isSyncing = syncStatus === 'syncing';

  let label = isEn ? 'Synced' : 'متصل ومحدث';
  if (isError) {
    label = isEn ? 'Sync Error' : 'تعذر المزامنة';
  } else if (isOffline) {
    label = isEn ? 'Offline' : 'غير متصل';
  } else if (isSyncing) {
    label = isEn ? 'Syncing...' : 'جاري المزامنة...';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
        onClick ? 'cursor-pointer active:scale-95' : 'cursor-default'
      } ${
        isError
          ? 'bg-coral/10 text-coral border-coral/30'
          : isOffline
          ? 'bg-slate/10 text-slate border-slate/30'
          : 'bg-mint-soft text-navy border-line'
      } ${className}`.trim()}
      title={lastSyncTime ? `${isEn ? 'Last sync:' : 'آخر مزامنة:'} ${lastSyncTime}` : undefined}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isError
            ? 'bg-coral'
            : isOffline
            ? 'bg-slate'
            : isSyncing
            ? 'bg-navy animate-pulse'
            : 'bg-teal'
        }`}
      />
      <span>{label}</span>
      {isSyncing && (
        <AppIcon name="spinner" size={11} className="animate-spin text-navy" />
      )}
    </button>
  );
};

export default SyncStatusPill;
