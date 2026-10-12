/**
 * Centralized API & Backend Network Configuration
 * Supports both Web Browser (relative /api/*) and Capacitor Android APK (Remote Cloud Server or Custom Backend).
 */

export const DEFAULT_CLOUD_BACKEND = 'https://ais-dev-adpuarqbpynynqoz4qzxfl-437409349781.europe-west2.run.app';

export interface BackendStatus {
  isConfigured: boolean;
  isReachable: boolean;
  latencyMs: number;
  url: string;
  hasApiKey: boolean;
  error?: string;
}

export function isNativeEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const isCap = Boolean((window as any).Capacitor);
  const isCapProtocol = window.location.protocol === 'capacitor:';
  const isAndroidWebView = /wv|Android.*Version\/[0-9.]+/i.test(navigator.userAgent);
  const isLocalhostApp = window.location.hostname === 'localhost' && window.location.port === '';
  return isCap || isCapProtocol || isAndroidWebView || isLocalhostApp;
}

export function getBackendUrl(): string {
  if (typeof window === 'undefined') return '';

  // 1. Check custom user override in localStorage
  const savedUrl = localStorage.getItem('NEUROCORE_BACKEND_URL');
  if (savedUrl && savedUrl.trim()) {
    return savedUrl.trim().replace(/\/+$/, '');
  }

  // 2. When running inside Android Capacitor APK (where localhost has no backend)
  if (isNativeEnvironment()) {
    return DEFAULT_CLOUD_BACKEND;
  }

  // 3. Running in Web Browser (Dev server or preview deployment)
  return '';
}

export function setBackendUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const clean = url.trim().replace(/\/+$/, '');
  if (!clean || clean === DEFAULT_CLOUD_BACKEND) {
    localStorage.removeItem('NEUROCORE_BACKEND_URL');
  } else {
    localStorage.setItem('NEUROCORE_BACKEND_URL', clean);
  }
}

export function getClientGeminiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('NEUROCORE_GEMINI_KEY') || '';
}

export function setClientGeminiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const clean = key.trim();
  if (!clean) {
    localStorage.removeItem('NEUROCORE_GEMINI_KEY');
  } else {
    localStorage.setItem('NEUROCORE_GEMINI_KEY', clean);
  }
}

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = getBackendUrl();
  return `${base}${cleanPath}`;
}

export function getWsUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = getBackendUrl();

  if (!base) {
    if (typeof window === 'undefined') return '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${cleanPath}`;
  }

  // Convert http/https to ws/wss
  const wsBase = base.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  return `${wsBase}${cleanPath}`;
}

export async function testBackendConnection(targetUrl?: string): Promise<BackendStatus> {
  const urlToTest = targetUrl !== undefined ? targetUrl.trim().replace(/\/+$/, '') : getBackendUrl();
  const healthEndpoint = urlToTest ? `${urlToTest}/api/health` : '/api/health';
  const start = performance.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(healthEndpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    const latencyMs = Math.round(performance.now() - start);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        isConfigured: true,
        isReachable: true,
        latencyMs,
        url: urlToTest || 'المحلي (Local)',
        hasApiKey: Boolean(data.hasApiKey),
      };
    }

    return {
      isConfigured: true,
      isReachable: false,
      latencyMs,
      url: urlToTest || 'المحلي (Local)',
      hasApiKey: false,
      error: `رمز الاستجابة: ${res.status}`,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      isConfigured: true,
      isReachable: false,
      latencyMs,
      url: urlToTest || 'المحلي (Local)',
      hasApiKey: false,
      error: err.name === 'AbortError' ? 'انتهت مهلة الاتصال (Timeout)' : 'تعذر الوصول إلى الخادم',
    };
  }
}
