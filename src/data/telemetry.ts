import { getState } from './connection-store';

declare const __platform__: number;

const CHIRP_URL = 'https://api.chirp247.com/api/v1/event';
const API_KEY = 'mango';
const APP_VERSION = '1.0.0';

let platformName = 'unknown';
if (__platform__ === 0) platformName = 'macos';
else if (__platform__ === 1) platformName = 'ios';
else if (__platform__ === 2) platformName = 'android';
else if (__platform__ === 3) platformName = 'windows';
else if (__platform__ === 4) platformName = 'linux';
else if (__platform__ === 5) platformName = 'web';

function trackEvent(event: string, dims: string): void {
  try {
    const val = getState('analyticsEnabled');
    if (val === '0' || val === 'false') return;
    const body = '{"event":"' + event + '","dims":' + dims + '}';
    fetch(CHIRP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Chirp-Key': API_KEY },
      body: body,
    }).catch(() => {});
  } catch (_e) {
    // Telemetry must never crash the app
  }
}

export function trackAppLaunch(): void {
  trackEvent('app_launch', '{"platform":"' + platformName + '","version":"' + APP_VERSION + '"}');
}

export function trackConnect(): void {
  trackEvent('connect', '{"platform":"' + platformName + '","version":"' + APP_VERSION + '"}');
}

export function trackQuery(): void {
  trackEvent('query', '{"platform":"' + platformName + '"}');
}
