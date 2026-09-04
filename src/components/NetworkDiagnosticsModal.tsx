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
} from 'lucide-react';
import {
  HealthCheckDiagnosticResult,
  runExactHealthCheckDiagnostics,
  getLatestHealthCheckDiagnostics,
} from '../utils/diagnostics';
import { checkOverallConnectivity } from '../utils/network';

interface NetworkDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NetworkDiagnosticsModal: React.FC<NetworkDiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
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
    const report = `=== TEACHER MANAGER ANDROID / WEB RUNTIME DIAGNOSTICS ===
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

  if (!isOpen) return null;

  const isSuccess = diagnostics?.conclusion === 'SUCCESS_HEALTHY';
  const isHttpError = diagnostics?.conclusion === 'HTTP_ERROR';
  const isException = diagnostics?.conclusion === 'NETWORK_EXCEPTION';

  return (
    <div
      id="diagnostics_modal_backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
      dir="rtl"
    >
      <div
        id="diagnostics_modal_content"
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col text-slate-100 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isSuccess
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                لوحة تشخيص الشبكة والسيرفر
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  Android APK Runtime
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                فحص مباشر وحي للاتصال بنظام Google Cloud Run و Firestore
              </p>
            </div>
          </div>
          <button
            id="close_diagnostics_modal_button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-sm font-sans flex-1">
          {/* Main Status Badge */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isSuccess
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : isHttpError
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {isSuccess && <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />}
              {isHttpError && <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />}
              {isException && <XCircle className="w-6 h-6 text-rose-400 shrink-0" />}
              <div>
                <div className="font-bold text-sm sm:text-base">
                  {isSuccess
                    ? 'السيرفر وقاعدة البيانات متصلان ويعملان بكفاءة'
                    : isHttpError
                    ? `استجابة غير متوقعة (HTTP ${diagnostics?.httpStatusCode})`
                    : 'تعذر الاتصال بالسيرفر السحابي'}
                </div>
                <div className="text-xs opacity-80 mt-0.5">
                  {diagnostics?.diagnosticSummary || 'جاري الفحص...'}
                </div>
              </div>
            </div>
            <div className="text-left font-mono text-xs px-2.5 py-1 rounded bg-black/30">
              {diagnostics?.requestDurationMs || 0}ms
            </div>
          </div>

          {/* Grid of Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 block mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                window.location.origin
              </span>
              <span className="font-mono text-slate-200 break-all">
                {diagnostics?.windowLocationOrigin || 'N/A'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 block mb-1 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                navigator.onLine
              </span>
              <span className="font-mono font-bold text-slate-200">
                {diagnostics?.navigatorOnLine ? 'true (متصل)' : 'false (غير متصل)'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 block mb-1 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Native Network
              </span>
              <span className="font-mono text-slate-200">
                {diagnostics?.nativeNetworkConnected ? 'Connected' : 'Disconnected'} (
                {diagnostics?.nativeConnectionType})
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 block mb-1 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                HTTP Status Code
              </span>
              <span className="font-mono font-bold text-slate-200">
                {diagnostics?.httpStatusCode || '0'} (ok: {String(diagnostics?.responseOk)})
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 block mb-1 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Backend Database
              </span>
              <span className="font-mono text-emerald-300 text-xs truncate block">
                {diagnostics?.parsedJson?.database || (diagnostics?.responseOk ? 'Firebase Firestore' : 'Checking...')}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 block mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                Timeout / Duration
              </span>
              <span className="font-mono text-slate-200">
                {diagnostics?.requestDurationMs || 0}ms / {diagnostics?.timeoutValueMs || 0}ms
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 block mb-1 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                Client Mechanism
              </span>
              <span className="font-mono text-slate-200">
                {diagnostics?.clientMechanism || 'N/A'}
              </span>
            </div>
          </div>

          {/* Exact Target URL */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
            <div className="text-slate-400 text-[11px] font-sans">
              العنوان الدائم للطلب (Request Target URL):
            </div>
            <div className="text-sky-300 break-all p-2 rounded bg-slate-900 border border-slate-800/80 select-all">
              <span className="text-amber-400 font-bold ml-2">GET</span>
              {diagnostics?.exactHealthCheckUrl || 'Loading...'}
            </div>
          </div>

          {/* Parsed JSON Response */}
          {diagnostics?.parsedJson && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-slate-400 text-xs flex items-center justify-between">
                <span>البيانات المستلمة من السيرفر (Parsed JSON):</span>
                <span className="text-emerald-400 text-[10px] font-mono">Valid JSON</span>
              </div>
              <pre className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto max-h-36">
                {JSON.stringify(diagnostics.parsedJson, null, 2)}
              </pre>
            </div>
          )}

          {/* Raw Response Text if not JSON */}
          {diagnostics?.rawResponseText && !diagnostics?.parsedJson && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-slate-400 text-xs">النص الخام للاستجابة (Raw Response Text):</div>
              <pre className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-amber-300 overflow-x-auto max-h-36">
                {diagnostics.rawResponseText}
              </pre>
            </div>
          )}

          {/* Exceptions if any */}
          {diagnostics?.hasException && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 space-y-1.5">
              <div className="text-rose-300 text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                تفاصيل الاستثناء (Exception Details):
              </div>
              <div className="font-mono text-xs text-rose-200 bg-rose-900/30 p-2.5 rounded border border-rose-800/40 break-all space-y-1">
                <div>
                  <span className="text-rose-400 font-bold">Name:</span>{' '}
                  {diagnostics.exceptionName}
                </div>
                <div>
                  <span className="text-rose-400 font-bold">Message:</span>{' '}
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
        <div className="p-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-2">
          <button
            id="run_health_check_button"
            onClick={handleRunCheck}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs sm:text-sm transition shadow disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'جاري الفحص...' : 'إعادة فحص السيرفر الآن'}
          </button>

          <div className="flex items-center gap-2">
            <button
              id="copy_diagnostics_button"
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition border border-slate-700"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  تم النسخ
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  نسخ التقرير
                </>
              )}
            </button>

            <button
              id="close_diagnostics_button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
