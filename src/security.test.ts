import { describe, expect, it } from 'vitest';
import { acceptWebhookOnce, canAuthenticate, canModerate, canModifyResource, isSubscriptionActive } from './security';

describe('account and authorization boundaries', () => {
  it('requires a verified phone or email before authenticated actions', () => {
    expect(canAuthenticate(false, false)).toBe(false);
    expect(canAuthenticate(true, false)).toBe(true);
    expect(canAuthenticate(false, true)).toBe(true);
  });

  it('allows owners and moderators to modify resources, but not unrelated residents', () => {
    expect(canModifyResource('user-1', 'user-1', 'RESIDENT')).toBe(true);
    expect(canModifyResource('user-2', 'user-1', 'RESIDENT')).toBe(false);
    expect(canModifyResource('moderator-1', 'user-1', 'MODERATOR')).toBe(true);
    expect(canModerate('BUSINESS_OWNER')).toBe(false);
    expect(canModerate('ADMIN')).toBe(true);
  });
});

describe('payment and entitlement safety', () => {
  it('accepts a payment webhook only once', () => {
    const first = acceptWebhookOnce(new Set(), 'pay_123');
    const second = acceptWebhookOnce(first.nextIds, 'pay_123');
    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(false);
    expect(second.nextIds.size).toBe(1);
  });

  it('expires entitlements at the boundary and ignores cancelled subscriptions', () => {
    const now = new Date('2026-09-10T10:00:00.000Z');
    expect(isSubscriptionActive('ACTIVE', new Date('2026-09-10T10:00:01.000Z'), now)).toBe(true);
    expect(isSubscriptionActive('ACTIVE', new Date('2026-09-10T10:00:00.000Z'), now)).toBe(false);
    expect(isSubscriptionActive('CANCELLED', new Date('2026-12-10T10:00:00.000Z'), now)).toBe(false);
  });
});
