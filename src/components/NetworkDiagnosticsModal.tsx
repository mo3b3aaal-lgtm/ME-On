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
  const { isRTL } = useTranslation();
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
        className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 bg-[#17163D]/70 backdrop-blur-sm animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div
          id="diagnostics_modal_content"
          className="bg-[#17163D] border border-[#403B9C] rounded-[28px] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col text-slate-100 overflow-hidden"
        >
        {/* Signature Dark Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#403B9C]/40 bg-[#17163D] sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${
                isSuccess
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2 truncate">
                <span>تشخيص شبكة وسيرفر Classy</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-[#55C7E8] border border-white/10">
                  Android APK Runtime
                </span>
              </h2>
              <p className="text-xs text-[#E8E7FF]/70 font-medium truncate">
                فحص مباشر وحي للاتصال بنظام Cloud Run وقاعدة بيانات Firebase
              </p>
            </div>
          </div>
          <button
            id="close_diagnostics_modal_button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer relative z-10 active:scale-95"
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
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                : isHttpError
                ? 'bg-amber-950/50 border-amber-500/40 text-amber-200'
                : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {isSuccess && <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />}
              {isHttpError && <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />}
              {isException && <XCircle className="w-6 h-6 text-[#FF647C] shrink-0" />}
              <div className="min-w-0">
                <div className="font-black text-xs sm:text-sm">
                  {isSuccess
                    ? 'السيرفر وقاعدة البيانات متصلان ويعملان بكفاءة'
                    : isHttpError
                    ? `استجابة غير متوقعة (HTTP ${diagnostics?.httpStatusCode})`
                    : 'تعذر الاتصال بالسيرفر السحابي'}
                </div>
                <div className="text-[11px] opacity-80 mt-0.5 font-medium truncate">
                  {diagnostics?.diagnosticSummary || 'جاري الفحص...'}
                </div>
              </div>
            </div>
            <div className="text-left font-mono text-xs px-2.5 py-1 rounded-xl bg-black/40 text-emerald-400 font-bold shrink-0">
              {diagnostics?.requestDurationMs || 0}ms
            </div>
          </div>

          {/* Grid of Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-2xl bg-[#25225C]/50 border border-[#403B9C]/40">
              <span className="text-[#E8E7FF]/70 block mb-1 font-bold flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#55C7E8]" />
                Origin
              </span>
              <span className="font-mono text-white break-all text-[11px]">
                {diagnostics?.windowLocationOrigin || 'N/A'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#25225C]/50 border border-[#403B9C]/40">
              <span className="text-[#E8E7FF]/70 block mb-1 font-bold flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                navigator.onLine
              </span>
              <span className="font-mono font-bold text-white">
                {diagnostics?.navigatorOnLine ? 'true (متصل)' : 'false (غير متصل)'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#25225C]/50 border border-[#403B9C]/40">
              <span className="text-[#E8E7FF]/70 block mb-1 font-bold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Native Network
              </span>
              <span className="font-mono text-white text-[11px]">
                {diagnostics?.nativeNetworkConnected ? 'Connected' : 'Disconnected'} (
                {diagnostics?.nativeConnectionType})
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#25225C]/50 border border-[#403B9C]/40">
              <span className="text-[#E8E7FF]/70 block mb-1 font-bold flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#7657F6]" />
                HTTP Status
              </span>
              <span className="font-mono font-bold text-white">
                {diagnostics?.httpStatusCode || '0'} (ok: {String(diagnostics?.responseOk)})
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#25225C]/50 border border-[#403B9C]/40">
              <span className="text-[#E8E7FF]/70 block mb-1 font-bold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Database Engine
              </span>
              <span className="font-mono text-emerald-300 text-xs truncate block font-bold">
                {diagnostics?.parsedJson?.database || (diagnostics?.responseOk ? 'Firebase Firestore' : 'Checking...')}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#25225C]/50 border border-[#403B9C]/40">
              <span className="text-[#E8E7FF]/70 block mb-1 font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#55C7E8]" />
                Duration / Timeout
              </span>
              <span className="font-mono text-white">
                {diagnostics?.requestDurationMs || 0}ms / {diagnostics?.timeoutValueMs || 0}ms
              </span>
            </div>
          </div>

          {/* Exact Target URL */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-[#403B9C]/30 space-y-1.5 font-mono text-xs">
            <div className="text-[#E8E7FF]/70 text-[11px] font-sans font-bold">
              العنوان الدائم للطلب (Request Target URL):
            </div>
            <div className="text-[#55C7E8] break-all p-2.5 rounded-xl bg-black/30 border border-white/10 select-all">
              <span className="text-amber-400 font-bold ml-2">GET</span>
              {diagnostics?.exactHealthCheckUrl || 'Loading...'}
            </div>
          </div>

          {/* Parsed JSON Response */}
          {diagnostics?.parsedJson && (
            <div className="p-3.5 rounded-2xl bg-black/40 border border-[#403B9C]/30 space-y-1.5">
              <div className="text-[#E8E7FF]/70 text-xs font-bold flex items-center justify-between">
                <span>البيانات المستلمة من السيرفر (Parsed JSON):</span>
                <span className="text-emerald-400 text-[10px] font-mono">Valid JSON</span>
              </div>
              <pre className="p-3 rounded-xl bg-black/50 border border-white/10 font-mono text-xs text-emerald-300 overflow-x-auto max-h-36">
                {JSON.stringify(diagnostics.parsedJson, null, 2)}
              </pre>
            </div>
          )}

          {/* Raw Response Text if not JSON */}
          {diagnostics?.rawResponseText && !diagnostics?.parsedJson && (
            <div className="p-3.5 rounded-2xl bg-black/40 border border-[#403B9C]/30 space-y-1.5">
              <div className="text-[#E8E7FF]/70 text-xs font-bold">النص الخام للاستجابة (Raw Response Text):</div>
              <pre className="p-3 rounded-xl bg-black/50 border border-white/10 font-mono text-xs text-amber-300 overflow-x-auto max-h-36">
                {diagnostics.rawResponseText}
              </pre>
            </div>
          )}

          {/* Exceptions if any */}
          {diagnostics?.hasException && (
            <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-800/60 space-y-2">
              <div className="text-rose-300 text-xs font-black flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#FF647C]" />
                تفاصيل الاستثناء (Exception Details):
              </div>
              <div className="font-mono text-xs text-rose-200 bg-rose-900/30 p-2.5 rounded-xl border border-rose-800/40 break-all space-y-1">
                <div>
                  <span className="text-[#FF647C] font-bold">Name:</span>{' '}
                  {diagnostics.exceptionName}
                </div>
                <div>
                  <span className="text-[#FF647C] font-bold">Message:</span>{' '}
                  {diagnostics.exceptionMessage}
                </div>
                {diagnostics.exceptionStack && (
                  <div className="text-[10px] text-rose-300/70 mt-2 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {diagnostics.exceptionStack}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#403B9C]/40 bg-[#17163D] flex items-center justify-between gap-2.5">
          <button
            id="run_health_check_button"
            onClick={handleRunCheck}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#7657F6] to-[#403B9C] hover:brightness-105 text-white font-black text-xs transition-all shadow-lg shadow-[#7657F6]/30 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'جاري الفحص...' : 'إعادة فحص السيرفر'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              id="copy_diagnostics_button"
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-black transition-all border border-white/15 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#55C7E8]" />
                  <span>نسخ التقرير</span>
                </>
              )}
            </button>

            <button
              id="close_diagnostics_button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-[#E8E7FF] text-xs font-black transition-all border border-white/15 cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
