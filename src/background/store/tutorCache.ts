export type TutorCacheEntry = {
  body: string;
  createdAt: number;
};

const cache = new Map<string, TutorCacheEntry>();
const pending = new Map<string, Promise<string | null>>();

const MAX_CACHE_ENTRIES = 200;
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 min

function normalizePart(value: string | undefined | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 220);
}

export function buildTutorCacheKey(input: {
  concept: string;
  masteryBand: "beginner" | "intermediate" | "advanced";
  pageTitle?: string;
  sentenceContext?: string;
}): string {
  return [
    normalizePart(input.concept),
    normalizePart(input.masteryBand),
    normalizePart(input.pageTitle),
    normalizePart(input.sentenceContext)
  ].join("::");
}

export function getCachedTutorBody(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.createdAt;
  if (age > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.body;
}

export function setCachedTutorBody(key: string, body: string) {
  if (!body.trim()) return;

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }

  cache.set(key, {
    body: body.trim(),
    createdAt: Date.now()
  });
}

export function getPendingTutorRequest(key: string): Promise<string | null> | null {
  return pending.get(key) ?? null;
}

export function setPendingTutorRequest(key: string, promise: Promise<string | null>) {
  pending.set(key, promise);
}

export function clearPendingTutorRequest(key: string) {
  pending.delete(key);
}

export function clearTutorCache() {
  cache.clear();
  pending.clear();
}