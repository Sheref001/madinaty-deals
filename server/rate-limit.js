// Limits are per process. A shared store is needed for multiple server instances.
export function createRateLimiter({ limit, windowMs, maxKeys = 10000 }) {
  const buckets = new Map();
  return {
    take(key, now = Date.now()) {
      for (const [storedKey, bucket] of buckets) {
        if (bucket.expiresAt <= now) buckets.delete(storedKey);
        else break;
      }
      let bucket = buckets.get(key);
      if (!bucket) {
        if (buckets.size >= maxKeys) return false;
        bucket = { count: 0, expiresAt: now + windowMs };
        buckets.set(key, bucket);
      }
      if (bucket.count >= limit) return false;
      bucket.count += 1;
      return true;
    },
    release(key) { buckets.delete(key); },
  };
}
