/**
 * Centralized API & Cloud Configuration for Teacher Manager
 * 
 * Single source of truth for backend endpoints, cloud service configuration,
 * and Android Capacitor production networking.
 */
import { Capacitor } from '@capacitor/core';

export const CLOUD_CONFIG = {
  serviceName: 'teachermanager-backend',
  gcpProject: 'corded-elevator-cf6jr',
  firestoreDatabase: 'ai-studio-teacherskdb-2ab7b23f-628d-4bc7-9c38-f649ca7153f9',
  region: 'europe-west2',
  permanentProductionUrl: 'https://ais-dev-bumcipp7qg5qixdbptx3o7-577166781335.europe-west2.run.app',
};

const STORAGE_KEY_CUSTOM_API_URL = 'tm_custom_api_base_url';

/**
 * Returns the permanent production API base URL.
 * Never returns localhost, file://, or capacitor:// in APK production mode.
 */
export function getPermanentProductionApiUrl(): string {
  // Check if custom server URL is set in local storage (e.g. self-hosted Cloud Run or custom domain)
  if (typeof window !== 'undefined' && window.localStorage) {
    const custom = window.localStorage.getItem(STORAGE_KEY_CUSTOM_API_URL);
    if (custom && custom.startsWith('http')) {
      return custom.replace(/\/+$/, '');
    }
  }

  // If in native Android Capacitor container or standalone app
  const isNative = Capacitor.isNativePlatform();
  if (
    isNative ||
    (typeof window !== 'undefined' &&
      (window.location.protocol === 'capacitor:' ||
        window.location.protocol === 'file:' ||
        (window.location.hostname === 'localhost' && window.location.port !== '3000')))
  ) {
    return CLOUD_CONFIG.permanentProductionUrl;
  }

  // Web environment fallback
  if (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http')) {
    if (window.location.hostname === 'localhost' && window.location.port === '3000') {
      return window.location.origin;
    }
    return window.location.origin;
  }

  return CLOUD_CONFIG.permanentProductionUrl;
}

/**
 * Allows setting a custom production server URL (for instance when custom domain is mapped)
 */
export function setCustomProductionApiUrl(url: string | null): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (url && url.trim()) {
      window.localStorage.setItem(STORAGE_KEY_CUSTOM_API_URL, url.trim().replace(/\/+$/, ''));
    } else {
      window.localStorage.removeItem(STORAGE_KEY_CUSTOM_API_URL);
    }
  }
}

/**
 * Constructs a fully qualified URL for any given API endpoint
 */
export function getFullApiUrl(endpointPath: string, customBaseUrl?: string): string {
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  const baseUrl = customBaseUrl || getPermanentProductionApiUrl();
  return `${baseUrl}${cleanPath}`;
}

export const API_ROUTES = {
  HEALTH: '/api/health',
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  SYNC_SESSION: '/api/auth/sync-session',
  SYNC_PUSH: '/api/sync/push',
  SYNC_PULL: '/api/sync/pull',
  SYNC_MERGE: '/api/sync/merge',
  AI_LESSON_PLAN: '/api/ai/lesson-plan',
  AI_QUIZ: '/api/ai/quiz',
  AI_REPORT: '/api/ai/report',
  AI_HOMEWORK_HELP: '/api/ai/homework-help',
} as const;
