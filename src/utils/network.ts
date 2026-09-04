import { Network, ConnectionStatus } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

export const PRIMARY_SERVER_API_URL = 'https://ais-dev-bumcipp7qg5qixdbptx3o7-577166781335.europe-west2.run.app';
export const SHARED_SERVER_API_URL = 'https://ais-pre-bumcipp7qg5qixdbptx3o7-577166781335.europe-west2.run.app';
export const DEPLOYED_SERVER_API_URL = PRIMARY_SERVER_API_URL;

let currentActiveBaseUrl: string = PRIMARY_SERVER_API_URL;

/**
 * Returns the fully qualified base URL for server API calls.
 * Ensures the Android Capacitor APK always points to the live production server.
 */
export function getServerApiBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) {
    const custom = (import.meta as any).env.VITE_API_URL.replace(/\/+$/, '');
    if (custom) return custom;
  }
  // In native Android APK or Capacitor local webview, ALWAYS route to production cloud API
  if (
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.protocol === 'capacitor:' ||
        (window.location.protocol === 'http:' && window.location.port === '')))
  ) {
    return currentActiveBaseUrl || PRIMARY_SERVER_API_URL;
  }
  if (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http')) {
    if (window.location.hostname === 'localhost' && window.location.port !== '3000') {
      return currentActiveBaseUrl || PRIMARY_SERVER_API_URL;
    }
    return window.location.origin;
  }
  return currentActiveBaseUrl || PRIMARY_SERVER_API_URL;
}

/**
 * Returns the complete URL for an API endpoint path.
 */
export function getFullApiUrl(endpointPath: string, overrideBaseUrl?: string): string {
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  const baseUrl = overrideBaseUrl || getServerApiBaseUrl();
  return `${baseUrl}${cleanPath}`;
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

    console.log(`[Network Diagnostics] Native status: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'} (type: ${connType})`);
    return { connected: isConnected, connectionType: connType };
  } catch (err) {
    const navOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    console.log(`[Network Diagnostics] Native status (fallback): connected=${navOnline}`);
    return { connected: navOnline, connectionType: navOnline ? 'unknown' : 'none' };
  }
}

/**
 * Checks if the production server API is healthy and reachable with comprehensive diagnostics.
 */
export async function checkApiHealth(
  timeoutMs = 8000
): Promise<{ ok: boolean; status?: string; database?: string; statusCode?: number; error?: string; url?: string }> {
  const candidateUrls = [getServerApiBaseUrl()];
  if (!candidateUrls.includes(PRIMARY_SERVER_API_URL)) candidateUrls.push(PRIMARY_SERVER_API_URL);
  if (!candidateUrls.includes(SHARED_SERVER_API_URL)) candidateUrls.push(SHARED_SERVER_API_URL);

  let lastError = 'No URL tested';
  let lastStatusCode = 0;

  for (const candidateBase of candidateUrls) {
    const healthUrl = getFullApiUrl('/api/health', candidateBase);
    console.log(`[Network Diagnostics] Probing API Health at: ${healthUrl} (timeout: ${timeoutMs}ms)`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(healthUrl, {
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
      lastStatusCode = res.status;

      console.log(`[Network Diagnostics] HTTP Status Code for ${healthUrl}: ${res.status} ${res.statusText}`);

      if (res.ok) {
        const data = await res.json().catch(() => ({ status: 'ok', database: 'connected' }));
        console.log(`[Network Diagnostics] API Health: REACHABLE (status: ${data.status}, db: ${data.database || 'ready'})`);
        currentActiveBaseUrl = candidateBase;
        return {
          ok: true,
          status: data.status || 'ok',
          database: data.database || 'Firebase Firestore',
          statusCode: res.status,
          url: healthUrl,
        };
      } else {
        const errText = await res.text().catch(() => '');
        console.warn(`[Network Diagnostics] API Health check UNREACHABLE (HTTP ${res.status}): ${errText.slice(0, 150)}`);
        lastError = `HTTP ${res.status}: ${res.statusText}`;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err.name === 'AbortError';
      const msg = isAbort ? `Timeout (exceeded ${timeoutMs}ms)` : err.message || 'Fetch NetworkError';
      console.warn(`[Network Diagnostics] Health check failed for ${healthUrl} - Reason: ${msg}`);
      lastError = msg;
    }
  }

  return { ok: false, error: lastError, statusCode: lastStatusCode, url: getFullApiUrl('/api/health') };
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
