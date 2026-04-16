type RateLimitState = {
  hits: number[];
};

const buckets = new Map<string, RateLimitState>();

export function checkInMemoryRateLimit({
  key,
  maxHits,
  windowMs,
  now = Date.now(),
}: {
  key: string;
  maxHits: number;
  windowMs: number;
  now?: number;
}) {
  const windowStart = now - windowMs;
  const state = buckets.get(key) ?? { hits: [] };
  state.hits = state.hits.filter((hit) => hit > windowStart);

  if (state.hits.length >= maxHits) {
    const retryAfterMs = Math.max(0, state.hits[0] + windowMs - now);
    buckets.set(key, state);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  state.hits.push(now);
  buckets.set(key, state);

  for (const [bucketKey, bucketState] of buckets) {
    bucketState.hits = bucketState.hits.filter((hit) => hit > windowStart);
    if (bucketState.hits.length === 0) {
      buckets.delete(bucketKey);
    }
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}
