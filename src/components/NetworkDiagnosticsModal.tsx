import React, { useState, useEffect, useRef } from 'react';
import {
  HealthCheckDiagnosticResult,
  runExactHealthCheckDiagnostics,
  getLatestHealthCheckDiagnostics,
} from '../utils/diagnostics';
import { checkOverallConnectivity } from '../utils/network';
import { useTranslation } from '../utils/i18n';
import { BottomSheet } from './ui/BottomSheet';
import { AppIcon } from './ui/AppIcon';
import { useDelayedLoading } from './ui/Skeleton';
import { NetworkDiagnosticsSkeleton } from './skeletons/ClassySkeletons';

interface NetworkDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NetworkDiagnosticsModal: React.FC<NetworkDiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  const [diagnostics, setDiagnostics] = useState<HealthCheckDiagnosticResult | null>(
    getLatestHealthCheckDiagnostics()
  );
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showInitialSkeleton = useDelayedLoading(isRunning && !diagnostics, 80);

  useEffect(() => {
    if (isOpen) {
      handleRunCheck();
    } else if (copiedTimerRef.current !== null) {
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = null;
      setCopied(false);
    }
    return () => {
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = null;
      }
    };
  }, [isOpen]);

  const handleRunCheck = async () => {
    setIsRunning(true);
    try {
      const res = await runExactHealthCheckDiagnostics(8000);
      setDiagnostics(res);
      await checkOverallConnectivity(true);
    } catch (e) {
      console.error('Diagnostics error:', e);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyReport = () => {
    if (!diagnostics) return;
    const report = `=== CLASSY ANDROID / WEB RUNTIME DIAGNOSTICS ===
Timestamp: ${diagnostics.timestamp}
Origin (window.location.origin): ${diagnostics.windowLocationOrigin}
navigator.onLine: ${diagnostics.navigatorOnLine}
Platform: ${diagnostics.platform} (isNative: ${diagnostics.isNativePlatform})
Native Network Status: ${diagnostics.nativeNetworkConnected ? 'Connected' : 'Disconnected'} (${diagnostics.nativeConnectionType})
Client Mechanism: ${diagnostics.clientMechanism}

Target API Base URL: ${diagnostics.apiBaseUrl}
Exact Health-Check URL: ${diagnostics.exactHealthCheckUrl}
Request Method: ${diagnostics.requestMethod}
Timeout Value: ${diagnostics.timeoutValueMs}ms
Duration: ${diagnostics.requestDurationMs}ms

HTTP Status Code: ${diagnostics.httpStatusCode}
response.ok: ${diagnostics.responseOk}
Conclusion: ${diagnostics.conclusion}
Summary: ${diagnostics.diagnosticSummary}

Parsed JSON:
${JSON.stringify(diagnostics.parsedJson, null, 2)}

Raw Response Text:
${diagnostics.rawResponseText}

Exceptions:
Has Exception: ${diagnostics.hasException}
Name: ${diagnostics.exceptionName || 'None'}
Message: ${diagnostics.exceptionMessage || 'None'}
Stack: ${diagnostics.exceptionStack || 'None'}
==========================================================`;

    navigator.clipboard.writeText(report).then(() => {
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current);
      }
      setCopied(true);
      copiedTimerRef.current = setTimeout(() => {
        copiedTimerRef.current = null;
        setCopied(false);
      }, 2500);
    });
  };

  if (!isOpen) return null;

  const isSuccess = diagnostics?.conclusion === 'SUCCESS_HEALTHY';
  const isHttpError = diagnostics?.conclusion === 'HTTP_ERROR';
  const isException = diagnostics?.conclusion === 'NETWORK_EXCEPTION';

  return (
    <BottomSheet
      id="network-diagnostics"
      isOpen={isOpen}
      onClose={onClose}
      title={isEn ? 'Server & Network Diagnostics' : 'تشخيص شبكة وسيرفر Classy'}
      subtitle={
        isEn
          ? 'Live verification of connectivity to Cloud and database'
          : 'فحص مباشر وحي للاتصال بالسيرفر وقاعدة البيانات'
      }
      headerLeading={
        <div className="w-10 h-10 rounded-2xl bg-mint-soft text-navy flex items-center justify-center shrink-0 border border-line">
          <AppIcon name="wifi" size={20} weight="duotone" />
        </div>
      }
      headerTrailing={
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-mint-soft text-navy border border-line">
          APK / Web
        </span>
      }
      maxWidthClass="sm:max-w-xl"
      footer={
        <div className="flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleRunCheck}
            disabled={isRunning}
            className="btn-orange px-4 text-xs"
          >
            <AppIcon name="refresh" size={14} className={isRunning ? 'animate-spin' : ''} />
            <span>
              {isRunning
                ? isEn ? 'Checking...' : 'جاري الفحص...'
                : isEn ? 'Recheck' : 'إعادة الفحص'}
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyReport}
              className="btn-soft px-4 text-xs"
            >
              <AppIcon name={copied ? 'check' : 'copy'} size={14} />
              <span>{copied ? (isEn ? 'Copied' : 'تم النسخ') : (isEn ? 'Copy Log' : 'نسخ التقرير')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-soft px-4 text-xs"
            >
              {t('close')}
            </button>
          </div>
        </div>
      }
    >
      {showInitialSkeleton ? (
        <NetworkDiagnosticsSkeleton />
      ) : (
      <div className="space-y-4 text-xs">
        {/* Main Status Badge */}
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
            isSuccess
              ? 'bg-mint-soft border-mint text-navy'
              : isHttpError
              ? 'bg-orange/10 border-orange text-navy'
              : 'bg-coral-soft border-coral/40 text-coral'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0">
              {isSuccess && <AppIcon name="checkCircle" size={24} weight="fill" className="text-navy" />}
              {isHttpError && <AppIcon name="warning" size={24} weight="fill" className="text-orange" />}
              {isException && <AppIcon name="close" size={24} weight="bold" className="text-coral" />}
            </div>
            <div className="min-w-0 text-start">
              <div className="font-black text-xs sm:text-sm text-navy">
                {isSuccess
                  ? (isEn ? 'Server & Database Operational' : 'السيرفر وقاعدة البيانات متصلان ويعملان بكفاءة')
                  : isHttpError
                  ? (isEn ? `Unexpected Response (HTTP ${diagnostics?.httpStatusCode})` : `استجابة غير متوقعة (HTTP ${diagnostics?.httpStatusCode})`)
                  : (isEn ? 'Could not connect to Cloud Server' : 'تعذر الاتصال بالسيرفر السحابي')}
              </div>
              <div className="text-[11px] text-slate mt-0.5 font-medium truncate">
                {diagnostics?.diagnosticSummary || (isEn ? 'Running checks...' : 'جاري الفحص...')}
              </div>
            </div>
          </div>
          <div className="font-mono text-xs px-2.5 py-1 rounded-xl bg-navy text-white font-bold shrink-0">
            {diagnostics?.requestDurationMs || 0}ms
          </div>
        </div>

        {/* Grid of Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-start">
          <div className="p-3 rounded-2xl bg-page border border-line space-y-1">
            <span className="text-slate block font-bold flex items-center gap-1.5">
              <AppIcon name="filter" size={13} className="text-navy" />
              Origin
            </span>
            <span className="font-mono text-navy break-all text-[11px] font-semibold block">
              {diagnostics?.windowLocationOrigin || 'N/A'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-page border border-line space-y-1">
            <span className="text-slate block font-bold flex items-center gap-1.5">
              <AppIcon name="wifi" size={13} className="text-navy" />
              navigator.onLine
            </span>
            <span className="font-mono font-bold text-navy block">
              {diagnostics?.navigatorOnLine
                ? (isEn ? 'Connected' : 'متصل')
                : (isEn ? 'Disconnected' : 'غير متصل')}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-page border border-line space-y-1">
            <span className="text-slate block font-bold flex items-center gap-1.5">
              <AppIcon name="zap" size={13} className="text-navy" />
              Native Network
            </span>
            <span className="font-mono text-navy text-[11px] font-semibold block">
              {diagnostics?.nativeNetworkConnected ? 'Connected' : 'Disconnected'} (
              {diagnostics?.nativeConnectionType})
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-page border border-line space-y-1">
            <span className="text-slate block font-bold flex items-center gap-1.5">
              <AppIcon name="checkCircle" size={13} className="text-navy" />
              HTTP Status
            </span>
            <span className="font-mono font-bold text-navy block">
              {diagnostics?.httpStatusCode || '0'} (ok: {String(diagnostics?.responseOk)})
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-page border border-line space-y-1">
            <span className="text-slate block font-bold flex items-center gap-1.5">
              <AppIcon name="database" size={13} className="text-navy" />
              Database Engine
            </span>
            <span className="font-mono text-navy text-xs truncate block font-bold">
              {diagnostics?.parsedJson?.database || (diagnostics?.responseOk ? 'Firebase Firestore' : (isEn ? 'Checking...' : 'جاري الفحص...'))}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-page border border-line space-y-1">
            <span className="text-slate block font-bold flex items-center gap-1.5">
              <AppIcon name="clock" size={13} className="text-navy" />
              Duration
            </span>
            <span className="font-mono text-navy font-semibold block">
              {diagnostics?.requestDurationMs || 0}ms / {diagnostics?.timeoutValueMs || 0}ms
            </span>
          </div>
        </div>

        {/* Target URL */}
        <div className="p-3 rounded-2xl bg-page border border-line space-y-1 text-start">
          <span className="text-[11px] font-bold text-slate block">Healthcheck URL:</span>
          <div className="p-2 rounded-xl bg-mist border border-line font-mono text-[11px] text-navy font-semibold break-all select-all">
            {diagnostics?.exactHealthCheckUrl || 'N/A'}
          </div>
        </div>
      </div>
      )}
    </BottomSheet>
  );
};
