import type { AnalyticsEvent } from './types';

const eventBuffer: AnalyticsEvent[] = [];

export interface AnalyticsProvider {
  track(name: string, properties?: AnalyticsEvent['properties']): void;
}

const localProvider: AnalyticsProvider = {
  track(name, properties) {
    const event = { name, properties, occurredAt: new Date().toISOString() };
    eventBuffer.push(event);
    if (import.meta.env.DEV) console.info('[analytics]', event);
  },
};

let provider: AnalyticsProvider = localProvider;

export function configureAnalytics(nextProvider: AnalyticsProvider): void {
  provider = nextProvider;
}

export function track(name: string, properties?: AnalyticsEvent['properties']): void {
  provider.track(name, properties);
}

export function getTrackedEvents(): AnalyticsEvent[] {
  return [...eventBuffer];
}
