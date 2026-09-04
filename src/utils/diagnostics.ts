import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { getPermanentProductionApiUrl, getFullApiUrl } from '../config/api';
import { testDirectFirestoreHealth } from '../config/firebase';

export interface HealthCheckDiagnosticResult {
  timestamp: string;
  // Environment & Device
  windowLocationOrigin: string;
  navigatorOnLine: boolean;
  isNativePlatform: boolean;
  platform: string;
  nativeNetworkConnected: boolean;
  nativeConnectionType: string;
  
  // Direct Firestore status
  firestoreDirectConnected?: boolean;
  firestoreDatabaseId?: string;
  firestoreDurationMs?: number;

  // Request details
  apiBaseUrl: string;
  exactHealthCheckUrl: string;
  requestMethod: string;
  timeoutValueMs: number;
  clientMechanism: 'CapacitorHttp (Native)' | 'Standard Browser fetch()';
  
  // Response details
  httpStatusCode: number;
  responseOk: boolean;
  requestDurationMs: number;
  rawResponseText: string;
  parsedJson: any;
  responseHeaders: Record<string, string>;
  
  // Failure / Exceptions if any
  hasException: boolean;
  exceptionName?: string;
  exceptionMessage?: string;
  exceptionStack?: string;
  
  // Evaluation
  conclusion: 'SUCCESS_HEALTHY' | 'HTTP_ERROR' | 'NETWORK_EXCEPTION' | 'PARSE_ERROR';
  diagnosticSummary: string;
}

let latestDiagnosticResult: HealthCheckDiagnosticResult | null = null;
type DiagnosticListener = (result: HealthCheckDiagnosticResult) => void;
const diagnosticListeners = new Set<DiagnosticListener>();

export function getLatestHealthCheckDiagnostics(): HealthCheckDiagnosticResult | null {
  return latestDiagnosticResult;
}

export function subscribeToDiagnostics(listener: DiagnosticListener): () => void {
  diagnosticListeners.add(listener);
  if (latestDiagnosticResult) {
    listener(latestDiagnosticResult);
  }
  return () => {
    diagnosticListeners.delete(listener);
  };
}

function notifyDiagnosticListeners(res: HealthCheckDiagnosticResult): void {
  latestDiagnosticResult = res;
  diagnosticListeners.forEach((listener) => {
    try {
      listener(res);
    } catch (e) {
      console.error('[Diagnostics] Error in listener:', e);
    }
  });
}

/**
 * Executes the EXACT GET request to /api/health capturing complete runtime diagnostics.
 */
export async function runExactHealthCheckDiagnostics(
  customTimeoutMs = 8000
): Promise<HealthCheckDiagnosticResult> {
  const startTime = Date.now();
  const origin = typeof window !== 'undefined' ? window.location.origin || 'unknown' : 'server';
  const navOnLine = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  // 1. Get native network status
  let nativeConnected = true;
  let nativeConnectionType = 'unknown';
  try {
    const netStatus = await Network.getStatus();
    nativeConnected = Boolean(netStatus.connected);
    nativeConnectionType = netStatus.connectionType || 'unknown';
  } catch (e: any) {
    nativeConnected = navOnLine;
    nativeConnectionType = 'fallback_navigator';
  }

  const apiBaseUrl = getPermanentProductionApiUrl();
  const exactUrl = getFullApiUrl('/api/health');
  const requestMethod = 'GET';

  const diagnosticResult: HealthCheckDiagnosticResult = {
    timestamp: new Date().toISOString(),
    windowLocationOrigin: origin,
    navigatorOnLine: navOnLine,
    isNativePlatform: isNative,
    platform: platform,
    nativeNetworkConnected: nativeConnected,
    nativeConnectionType: nativeConnectionType,
    apiBaseUrl: apiBaseUrl,
    exactHealthCheckUrl: exactUrl,
    requestMethod: requestMethod,
    timeoutValueMs: customTimeoutMs,
    clientMechanism: isNative ? 'CapacitorHttp (Native)' : 'Standard Browser fetch()',
    httpStatusCode: 0,
    responseOk: false,
    requestDurationMs: 0,
    rawResponseText: '',
    parsedJson: null,
    responseHeaders: {},
    hasException: false,
    conclusion: 'NETWORK_EXCEPTION',
    diagnosticSummary: 'Initializing...',
  };

  // Attempt request
  try {
    if (isNative) {
      // In native Android Capacitor: Use native CapacitorHttp
      const httpRes = await CapacitorHttp.get({
        url: exactUrl,
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        readTimeout: customTimeoutMs,
        connectTimeout: customTimeoutMs,
      });

      const duration = Date.now() - startTime;
      diagnosticResult.requestDurationMs = duration;
      diagnosticResult.httpStatusCode = httpRes.status;
      diagnosticResult.responseOk = httpRes.status >= 200 && httpRes.status < 300;
      diagnosticResult.responseHeaders = (httpRes.headers as Record<string, string>) || {};
      
      const data = httpRes.data;
      if (typeof data === 'object' && data !== null) {
        diagnosticResult.parsedJson = data;
        diagnosticResult.rawResponseText = JSON.stringify(data, null, 2);
      } else {
        diagnosticResult.rawResponseText = String(data || '');
        try {
          diagnosticResult.parsedJson = JSON.parse(diagnosticResult.rawResponseText);
        } catch {
          diagnosticResult.parsedJson = null;
        }
      }

      if (diagnosticResult.responseOk && diagnosticResult.parsedJson?.status === 'ok') {
        diagnosticResult.conclusion = 'SUCCESS_HEALTHY';
        diagnosticResult.diagnosticSummary = `HTTP 200 OK received natively from ${exactUrl} in ${duration}ms (DB: ${diagnosticResult.parsedJson?.database || 'ready'})`;
      } else {
        diagnosticResult.conclusion = 'HTTP_ERROR';
        diagnosticResult.diagnosticSummary = `HTTP ${httpRes.status} received from ${exactUrl}`;
      }
    } else {
      // In browser: Use standard fetch with timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), customTimeoutMs);

      const response = await fetch(exactUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      diagnosticResult.requestDurationMs = duration;
      diagnosticResult.httpStatusCode = response.status;
      diagnosticResult.responseOk = response.ok;

      // Capture headers
      const headersMap: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        headersMap[key] = val;
      });
      diagnosticResult.responseHeaders = headersMap;

      const rawText = await response.text();
      diagnosticResult.rawResponseText = rawText;

      try {
        diagnosticResult.parsedJson = JSON.parse(rawText);
      } catch (jsonErr: any) {
        diagnosticResult.parsedJson = null;
        diagnosticResult.conclusion = 'PARSE_ERROR';
        diagnosticResult.diagnosticSummary = `Response was not valid JSON (received: ${rawText.slice(0, 100)})`;
      }

      if (diagnosticResult.responseOk && diagnosticResult.parsedJson?.status === 'ok') {
        diagnosticResult.conclusion = 'SUCCESS_HEALTHY';
        diagnosticResult.diagnosticSummary = `HTTP 200 OK received in ${duration}ms (DB: ${diagnosticResult.parsedJson?.database || 'ready'})`;
      } else if (!diagnosticResult.conclusion || diagnosticResult.conclusion === 'NETWORK_EXCEPTION') {
        diagnosticResult.conclusion = 'HTTP_ERROR';
        diagnosticResult.diagnosticSummary = `HTTP ${response.status} ${response.statusText} from ${exactUrl}`;
      }
    }
  } catch (err: any) {
    const duration = Date.now() - startTime;
    diagnosticResult.requestDurationMs = duration;
    diagnosticResult.hasException = true;
    diagnosticResult.exceptionName = err?.name || 'Error';
    diagnosticResult.exceptionMessage = err?.message || String(err);
    diagnosticResult.exceptionStack = err?.stack || undefined;
    diagnosticResult.conclusion = 'NETWORK_EXCEPTION';
    diagnosticResult.diagnosticSummary = `Exception (${diagnosticResult.exceptionName}): ${diagnosticResult.exceptionMessage}`;
  }

  // Also verify Direct Firebase Firestore connection
  try {
    const fsHealth = await testDirectFirestoreHealth();
    diagnosticResult.firestoreDirectConnected = fsHealth.ok;
    diagnosticResult.firestoreDatabaseId = 'ai-studio-teacherskdb-2ab7b23f-628d-4bc7-9c38-f649ca7153f9';
    diagnosticResult.firestoreDurationMs = fsHealth.durationMs;
    if (fsHealth.ok && diagnosticResult.conclusion !== 'SUCCESS_HEALTHY') {
      diagnosticResult.diagnosticSummary += ` | Direct Firestore: REACHABLE (${fsHealth.durationMs}ms)`;
    }
  } catch (fsErr) {
    diagnosticResult.firestoreDirectConnected = false;
  }

  notifyDiagnosticListeners(diagnosticResult);
  return diagnosticResult;
}
