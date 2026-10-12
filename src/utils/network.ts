import { Network, ConnectionStatus } from '@capacitor/network';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import {
  CLOUD_CONFIG,
  getPermanentProductionApiUrl,
  getFullApiUrl as configGetFullApiUrl,
  API_ROUTES,
} from '../config/api';
import { runExactHealthCheckDiagnostics } from './diagnostics';

export const PRIMARY_SERVER_API_URL = CLOUD_CONFIG.permanentProductionUrl;
export const DEPLOYED_SERVER_API_URL = PRIMARY_SERVER_API_URL;

/**
 * Returns the fully qualified base URL for server API calls.
 * Ensures the Android Capacitor APK always points to the live production server.
 */
export function getServerApiBaseUrl(): string {
  return getPermanentProductionApiUrl();
}

/**
 * Returns the complete URL for an API endpoint path.
 */
export function getFullApiUrl(endpointPath: string, overrideBaseUrl?: string): string {
  return configGetFullApiUrl(endpointPath, overrideBaseUrl);
}

export type NetworkStatusReason = 'online' | 'device_offline' | 'api_unreachable' | 'checking';

export interface DetailedNetworkStatus {
  isOnline: boolean;
  deviceConnected: boolean;
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
  apiReachable: boolean;
  resolvedApiBaseUrl: string;
  statusReason: NetworkStatusReason;
  lastChecked: string;
  statusCode?: number;
  diagnosticDetails?: string;
}

let cachedStatus: DetailedNetworkStatus = {
  isOnline: true,
  deviceConnected: true,
  connectionType: 'unknown',
  apiReachable: true,
  resolvedApiBaseUrl: getServerApiBaseUrl(),
  statusReason: 'checking',
  lastChecked: new Date().toISOString(),
};

type NetworkListener = (status: DetailedNetworkStatus) => void;
const listeners = new Set<NetworkListener>();

export function getCachedNetworkStatus(): DetailedNetworkStatus {
  return { ...cachedStatus };
}

function notifyListeners(): void {
  const copy = { ...cachedStatus };
  listeners.forEach((fn) => {
    try {
      fn(copy);
    } catch (err) {
      console.error('[Network] Listener notification error:', err);
    }
  });
}

export function subscribeToNetworkStatus(listener: NetworkListener): () => void {
  listeners.add(listener);
  // Emit current status immediately on subscription
  listener({ ...cachedStatus });
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Robust cross-platform API HTTP requester:
 * Uses native Android CapacitorHttp when running inside Capacitor APK (bypassing WebView CORS & cookie redirects)
 * Uses standard browser fetch() in Web / Chrome.
 */
export async function universalApiFetch(
  endpointOrFullUrl: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
    timeoutMs?: number;
  } = {}
): Promise<{ ok: boolean; status: number; data: any; rawText?: string; error?: string }> {
  const isFullUrl = endpointOrFullUrl.startsWith('http://') || endpointOrFullUrl.startsWith('https://');
  const targetUrl = isFullUrl ? endpointOrFullUrl : getFullApiUrl(endpointOrFullUrl);
  const method = options.method || 'GET';
  const timeoutMs = options.timeoutMs || 12000;
  const isNative = Capacitor.isNativePlatform();

  const reqHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };
  if (options.body && !reqHeaders['Content-Type']) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  console.log(`[Universal Fetch] [${isNative ? 'Native CapacitorHttp' : 'Web Fetch'}] ${method} ${targetUrl}`);

  if (isNative) {
    try {
      const httpRes = await CapacitorHttp.request({
        url: targetUrl,
        method: method,
        headers: reqHeaders,
        data: options.body,
        readTimeout: timeoutMs,
        connectTimeout: timeoutMs,
      });

      const isOk = httpRes.status >= 200 && httpRes.status < 300;
      let resData = httpRes.data;
      if (typeof resData === 'string') {
        try {
          resData = JSON.parse(resData);
        } catch {
          // keep as string
        }
      }

      console.log(`[Universal Fetch Native] Response status: ${httpRes.status}, ok: ${isOk}`);
      return {
        ok: isOk,
        status: httpRes.status,
        data: resData,
        rawText: typeof httpRes.data === 'string' ? httpRes.data : JSON.stringify(httpRes.data),
        error: isOk ? undefined : `HTTP ${httpRes.status}`,
      };
    } catch (nativeErr: any) {
      console.warn(`[Universal Fetch Native Error] ${nativeErr?.message || nativeErr}. Falling back to fetch...`);
    }
  }

  // Web or fallback fetch
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      method: method,
      headers: reqHeaders,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    const rawText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    return {
      ok: res.ok,
      status: res.status,
      data: data,
      rawText: rawText,
      error: res.ok ? undefined : `HTTP ${res.status}: ${res.statusText}`,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    const msg = isTimeout ? `Timeout after ${timeoutMs}ms` : err.message || 'Network fetch error';
    return {
      ok: false,
      status: 0,
      data: null,
      error: msg,
    };
  }
}

/**
 * Checks native device network status using @capacitor/network with fallback.
 */
export async function getDeviceNetworkStatus(): Promise<{
  connected: boolean;
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
}> {
  try {
    const status: ConnectionStatus = await Network.getStatus();
    const isConnected = Boolean(status.connected);
    const connType = ((status.connectionType as any) || (isConnected ? 'unknown' : 'none')) as
      | 'wifi'
      | 'cellular'
      | 'none'
      | 'unknown';

    return { connected: isConnected, connectionType: connType };
  } catch (err) {
    const navOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    return { connected: navOnline, connectionType: navOnline ? 'unknown' : 'none' };
  }
}

/**
 * Checks if the production server API is healthy and reachable with comprehensive diagnostics.
 */
export async function checkApiHealth(
  timeoutMs = 8000
): Promise<{ ok: boolean; status?: string; database?: string; statusCode?: number; error?: string; url?: string }> {
  const diag = await runExactHealthCheckDiagnostics(timeoutMs);

  if (diag.conclusion === 'SUCCESS_HEALTHY') {
    return {
      ok: true,
      status: diag.parsedJson?.status || 'ok',
      database: diag.parsedJson?.database || 'Firebase Firestore',
      statusCode: diag.httpStatusCode,
      url: diag.exactHealthCheckUrl,
    };
  }

  return {
    ok: false,
    error: diag.diagnosticSummary,
    statusCode: diag.httpStatusCode,
    url: diag.exactHealthCheckUrl,
  };
}

/**
 * Runs a comprehensive connectivity check:
 * 1. Checks device native connection
 * 2. Checks API health
 * 3. Updates cached status and notifies all subscribers
 */
export async function checkOverallConnectivity(silent = false): Promise<DetailedNetworkStatus> {
  const baseUrl = getServerApiBaseUrl();
  const device = await getDeviceNetworkStatus();

  // If device is completely offline (no Wi-Fi, no mobile data)
  if (!device.connected) {
    const wasOnline = cachedStatus.isOnline;
    cachedStatus = {
      isOnline: false,
      deviceConnected: false,
      connectionType: device.connectionType,
      apiReachable: false,
      resolvedApiBaseUrl: baseUrl,
      statusReason: 'device_offline',
      lastChecked: new Date().toISOString(),
    };
    if (!silent) console.log('[Network] Overall connectivity: OFFLINE (Device has no active network connection)');
    notifyListeners();
    return cachedStatus;
  }

  // Device has a network connection -> verify API reachability
  const health = await checkApiHealth(5000);
  const wasOnline = cachedStatus.isOnline;

  if (health.ok) {
    cachedStatus = {
      isOnline: true,
      deviceConnected: true,
      connectionType: device.connectionType,
      apiReachable: true,
      resolvedApiBaseUrl: baseUrl,
      statusReason: 'online',
      lastChecked: new Date().toISOString(),
    };
    if (!silent) console.log('[Network] Overall connectivity: ONLINE (Device connected & API reachable)');
  } else {
    cachedStatus = {
      isOnline: false,
      deviceConnected: true,
      connectionType: device.connectionType,
      apiReachable: false,
      resolvedApiBaseUrl: baseUrl,
      statusReason: 'api_unreachable',
      lastChecked: new Date().toISOString(),
    };
    if (!silent) console.log(`[Network] Overall connectivity: OFFLINE (Device connected via ${device.connectionType}, but API is unreachable)`);
  }

  notifyListeners();

  // If connection was restored, trigger reconnect callbacks
  if (!wasOnline && cachedStatus.isOnline) {
    console.log('[Network] Connection restored! Triggering reconnect handlers...');
    triggerReconnectCallbacks();
  }

  return cachedStatus;
}

// Reconnect callback registration
type ReconnectCallback = () => void;
const reconnectCallbacks = new Set<ReconnectCallback>();

export function onNetworkReconnected(cb: ReconnectCallback): () => void {
  reconnectCallbacks.add(cb);
  return () => {
    reconnectCallbacks.delete(cb);
  };
}

function triggerReconnectCallbacks(): void {
  reconnectCallbacks.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('[Network] Error in reconnect callback:', e);
    }
  });
}

// Global initialization of native network listeners
let initialized = false;
export function initNetworkMonitor(): void {
  if (typeof window === 'undefined' || initialized) return;
  initialized = true;

  console.log('[Network] Initializing native network monitor and listeners...');

  // 1. Initial health and connectivity probe
  checkOverallConnectivity(false).catch(() => {});

  // 2. Capacitor Network listener for real-time connection changes
  try {
    Network.addListener('networkStatusChange', async (status) => {
      console.log(`[Network] Capacitor networkStatusChange event received: connected=${status.connected}, type=${status.connectionType}`);
      await checkOverallConnectivity(false);
    });
  } catch (e) {
    console.warn('[Network] Could not attach Capacitor Network listener (browser mode):', e);
  }

  // 3. Web browser standard event listeners as complementary triggers
  window.addEventListener('online', () => {
    console.log('[Network] window "online" event fired');
    checkOverallConnectivity(false);
  });

  window.addEventListener('offline', () => {
    console.log('[Network] window "offline" event fired');
    checkOverallConnectivity(false);
  });

  // 4. Check connectivity when app is foregrounded / reopened
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('[Network] App became visible / foregrounded, checking connectivity...');
      checkOverallConnectivity(true);
    }
  });

  // 5. Periodic background health check (every 30 seconds)
  setInterval(() => {
    checkOverallConnectivity(true).catch(() => {});
  }, 30000);
}

// Auto-run network monitor
initNetworkMonitor();
