export type Role = 'RESIDENT' | 'SERVICE_PROVIDER' | 'BUSINESS_OWNER' | 'MODERATOR' | 'ADMIN';

export function canAuthenticate(phoneVerified: boolean, emailVerified: boolean): boolean {
  return phoneVerified || emailVerified;
}

export function canModifyResource(actorId: string, ownerId: string, role: Role): boolean {
  return actorId === ownerId || role === 'MODERATOR' || role === 'ADMIN';
}

export function canModerate(role: Role): boolean {
  return role === 'MODERATOR' || role === 'ADMIN';
}

export function acceptWebhookOnce(processedEventIds: ReadonlySet<string>, eventId: string): { accepted: boolean; nextIds: Set<string> } {
  if (processedEventIds.has(eventId)) return { accepted: false, nextIds: new Set(processedEventIds) };
  return { accepted: true, nextIds: new Set([...processedEventIds, eventId]) };
}

export function isSubscriptionActive(status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PAST_DUE', expiresAt: Date | null, now = new Date()): boolean {
  return status === 'ACTIVE' && expiresAt !== null && expiresAt.getTime() > now.getTime();
}
