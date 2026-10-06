import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  Globe,
  Wifi,
  Terminal,
  Shield,
  Clock,
  Zap,
  X,
} from 'lucide-react';
import {
  HealthCheckDiagnosticResult,
  runExactHealthCheckDiagnostics,
  getLatestHealthCheckDiagnostics,
} from '../utils/diagnostics';
import { checkOverallConnectivity } from '../utils/network';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { useTranslation } from '../utils/i18n';

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

  useEffect(() => {
    if (isOpen) {
      handleRunCheck();
    }
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const modalLayer = useModalLayer('network-diagnostics', isOpen, onClose);

  if (!isOpen) return null;

  const isSuccess = diagnostics?.conclusion === 'SUCCESS_HEALTHY';
  const isHttpError = diagnostics?.conclusion === 'HTTP_ERROR';
  const isException = diagnostics?.conclusion === 'NETWORK_EXCEPTION';

  return (
    <ModalPortal>
      <div
        id="diagnostics_modal_backdrop"
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 bg-[#6B1E2B]/70 backdrop-blur-sm animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div
          id="diagnostics_modal_content"
          className="bg-[#6B1E2B] border border-[#5C4033] rounded-[28px] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col text-[#FAF7F2] overflow-hidden"
        >
        {/* Signature Dark Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#5C4033]/40 bg-[#6B1E2B] sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${
                isSuccess
                  ? 'bg-[#EADBC7]/80 text-[#B68A4C] border border-[#B68A4C]/40'
                  : 'bg-[#B56B45]/20 text-[#B68A4C] border border-[#B68A4C]/40'
              }`}
            >
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-[#FAF7F2] flex items-center gap-2 truncate">
                <span>{isEn ? 'Classy Server & Network Diagnostics' : 'تشخيص شبكة وسيرفر Classy'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FAF7F2]/10 text-[#B68A4C] border border-[#EADBC7]/15">
                  Android APK Runtime
                </span>
              </h2>
              <p className="text-xs text-[#EADBC7]/70 font-medium truncate">
                {isEn ? 'Live verification of connectivity to Cloud Run and Firebase database' : 'فحص مباشر وحي للاتصال بنظام Cloud Run وقاعدة بيانات Firebase'}
              </p>
            </div>
          </div>
          <button
            id="close_diagnostics_modal_button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-[#FAF7F2]/10 hover:bg-[#FAF7F2]/20 text-[#FAF7F2] border border-[#EADBC7]/20 transition-all cursor-pointer relative z-10 active:scale-95"
            title={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto android-scrollbar space-y-4 text-xs font-sans flex-1">
          {/* Main Status Badge */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              isSuccess
                ? 'bg-[#5C4033]/50 border-[#B68A4C]/40 text-[#EADBC7]'
                : isHttpError
                ? 'bg-[#69493C]/50 border-[#B68A4C]/50 text-[#EADBC7]'
                : 'bg-[#46121B]/60 border-[#B56B45]/50 text-[#EADBC7]'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {isSuccess && <CheckCircle className="w-6 h-6 text-[#B68A4C] shrink-0" />}
              {isHttpError && <AlertTriangle className="w-6 h-6 text-[#B68A4C] shrink-0" />}
              {isException && <XCircle className="w-6 h-6 text-[#B56B45] shrink-0" />}
              <div className="min-w-0">
                <div className="font-black text-xs sm:text-sm">
                  {isSuccess
                    ? (isEn ? 'Server & Database Connected & Operational' : 'السيرفر وقاعدة البيانات متصلان ويعملان بكفاءة')
                    : isHttpError
                    ? (isEn ? `Unexpected Response (HTTP ${diagnostics?.httpStatusCode})` : `استجابة غير متوقعة (HTTP ${diagnostics?.httpStatusCode})`)
                    : (isEn ? 'Could not connect to Cloud Server' : 'تعذر الاتصال بالسيرفر السحابي')}
                </div>
                <div className="text-[11px] opacity-80 mt-0.5 font-medium truncate">
                  {diagnostics?.diagnosticSummary || (isEn ? 'Running checks...' : 'جاري الفحص...')}
                </div>
              </div>
            </div>
            <div className={`${isRTL ? 'text-left' : 'text-right'} font-mono text-xs px-2.5 py-1 rounded-xl bg-black/40 text-[#B68A4C] font-bold shrink-0`}>
              {diagnostics?.requestDurationMs || 0}ms
            </div>
          </div>

          {/* Grid of Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-2xl bg-[#5C4033]/50 border border-[#5C4033]/40">
              <span className="text-[#EADBC7]/70 block mb-1 font-bold flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#B68A4C]" />
                Origin
              </span>
              <span className="font-mono text-[#FAF7F2] break-all text-[11px]">
                {diagnostics?.windowLocationOrigin || 'N/A'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#5C4033]/50 border border-[#5C4033]/40">
              <span className="text-[#EADBC7]/70 block mb-1 font-bold flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-[#B68A4C]" />
                navigator.onLine
              </span>
              <span className="font-mono font-bold text-[#FAF7F2]">
                {diagnostics?.navigatorOnLine ? (isEn ? 'true (Connected)' : 'true (متصل)') : (isEn ? 'false (Disconnected)' : 'false (غير متصل)')}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#5C4033]/50 border border-[#5C4033]/40">
              <span className="text-[#EADBC7]/70 block mb-1 font-bold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#B68A4C]" />
                Native Network
              </span>
              <span className="font-mono text-[#FAF7F2] text-[11px]">
                {diagnostics?.nativeNetworkConnected ? 'Connected' : 'Disconnected'} (
                {diagnostics?.nativeConnectionType})
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#5C4033]/50 border border-[#5C4033]/40">
              <span className="text-[#EADBC7]/70 block mb-1 font-bold flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#6B1E2B]" />
                HTTP Status
              </span>
              <span className="font-mono font-bold text-[#FAF7F2]">
                {diagnostics?.httpStatusCode || '0'} (ok: {String(diagnostics?.responseOk)})
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#5C4033]/50 border border-[#5C4033]/40">
              <span className="text-[#EADBC7]/70 block mb-1 font-bold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#B68A4C]" />
                Database Engine
              </span>
              <span className="font-mono text-[#EADBC7] text-xs truncate block font-bold">
                {diagnostics?.parsedJson?.database || (diagnostics?.responseOk ? 'Firebase Firestore' : (isEn ? 'Checking...' : 'جاري الفحص...'))}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#5C4033]/50 border border-[#5C4033]/40">
              <span className="text-[#EADBC7]/70 block mb-1 font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#B68A4C]" />
                Duration / Timeout
              </span>
              <span className="font-mono text-[#FAF7F2]">
                {diagnostics?.requestDurationMs || 0}ms / {diagnostics?.timeoutValueMs || 0}ms
              </span>
            </div>
          </div>

          {/* Raw Endpoint details */}
          <div className="p-3.5 rounded-2xl bg-[#5C4033]/40 border border-[#5C4033]/40 space-y-2">
            <span className="text-[11px] font-bold text-[#EADBC7]/70 block">Target Healthcheck URL:</span>
            <div className="p-2.5 rounded-xl bg-black/40 border border-[#FAF7F2]/5 font-mono text-[11px] text-[#B68A4C] break-all select-all">
              {diagnostics?.exactHealthCheckUrl || 'N/A'}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#5C4033]/40 bg-[#6B1E2B] flex items-center justify-between gap-2.5">
          <button
            onClick={handleRunCheck}
            disabled={isRunning}
            className="px-4 py-2.5 rounded-2xl bg-[#5C4033] hover:bg-[#6B1E2B] text-[#FAF7F2] text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? (isEn ? 'Checking...' : 'جاري إعادة الفحص...') : (isEn ? 'Recheck' : 'إعادة الفحص')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReport}
              className="px-4 py-2.5 rounded-2xl bg-[#FAF7F2]/10 hover:bg-[#FAF7F2]/20 text-[#FAF7F2] text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#B68A4C]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? (isEn ? 'Copied' : 'تم النسخ') : (isEn ? 'Copy Log' : 'نسخ التقرير')}</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-[#FAF7F2] text-[#2F2F2F] text-xs font-black transition-all cursor-pointer hover:bg-[#EADBC7]/70"
            >
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
