import { Redis } from '@upstash/redis';
import {
  createDefaultTripData,
  TripData,
  TripDataSchema,
  TripMutation,
} from './schemas';

const TRIP_REDIS_KEY = 'japantrip:data:v1';

interface RedisCredentials {
  url: string;
  token: string;
  matchedEnvKey: string;
}

/**
 * Resolve Upstash / Vercel KV REST credentials regardless of prefix
 * (e.g. UPSTASH_REDIS_REST_URL, KV_REST_API_URL, japantrip_KV_REST_API_URL, japantrip_REDIS_URL).
 */
function findRedisCredentials(): RedisCredentials | null {
  const env = process.env;

  const directPairs: [string, string][] = [
    ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
  ];

  for (const [urlKey, tokenKey] of directPairs) {
    const url = env[urlKey];
    const token = env[tokenKey];
    if (url && token) {
      return { url, token, matchedEnvKey: urlKey };
    }
  }

  for (const [key, value] of Object.entries(env)) {
    if (!value || !value.startsWith('https://')) continue;
    const upper = key.toUpperCase();

    if (upper.endsWith('_KV_REST_API_URL')) {
      const prefix = key.slice(0, key.length - '_KV_REST_API_URL'.length);
      const token =
        env[`${prefix}_KV_REST_API_TOKEN`] ||
        env[`${prefix}_kv_rest_api_token`];
      if (token) return { url: value, token, matchedEnvKey: key };
    }

    if (upper.endsWith('_UPSTASH_REDIS_REST_URL')) {
      const prefix = key.slice(
        0,
        key.length - '_UPSTASH_REDIS_REST_URL'.length
      );
      const token = env[`${prefix}_UPSTASH_REDIS_REST_TOKEN`];
      if (token) return { url: value, token, matchedEnvKey: key };
    }

    if (upper.endsWith('_REDIS_REST_URL') || upper.endsWith('_REST_API_URL')) {
      const tokenKey = key.replace(/URL$/i, 'TOKEN');
      const token = env[tokenKey];
      if (token) return { url: value, token, matchedEnvKey: key };
    }
  }

  for (const [key, value] of Object.entries(env)) {
    if (!value || (!value.startsWith('rediss://') && !value.startsWith('redis://'))) {
      continue;
    }
    try {
      const parsed = new URL(value);
      if (parsed.hostname.endsWith('.upstash.io') && parsed.password) {
        return {
          url: `https://${parsed.hostname}`,
          token: decodeURIComponent(parsed.password),
          matchedEnvKey: key,
        };
      }
    } catch {
      // Ignore malformed URL
    }
  }

  return null;
}

function getRedis(): { client: Redis; matchedEnvKey: string } {
  const creds = findRedisCredentials();
  if (!creds) {
    throw new Error(
      'Variables Upstash Redis introuvables. En local, lancez `vercel env pull .env.local`.'
    );
  }
  return {
    client: new Redis({ url: creds.url, token: creds.token }),
    matchedEnvKey: creds.matchedEnvKey,
  };
}

export async function readTripData(): Promise<{
  data: TripData;
  matchedEnvKey: string;
}> {
  const { client, matchedEnvKey } = getRedis();
  const raw = await client.get<unknown>(TRIP_REDIS_KEY);
  if (raw) {
    const parsed = TripDataSchema.safeParse(raw);
    if (parsed.success) {
      return { data: parsed.data, matchedEnvKey };
    }
  }

  const initial = createDefaultTripData();
  await client.set(TRIP_REDIS_KEY, initial);
  return { data: initial, matchedEnvKey };
}

export async function writeTripData(data: TripData): Promise<{
  matchedEnvKey: string;
}> {
  const { client, matchedEnvKey } = getRedis();
  const validated = TripDataSchema.parse({
    ...data,
    updatedAt: new Date().toISOString(),
  });
  await client.set(TRIP_REDIS_KEY, validated);
  return { matchedEnvKey };
}

export async function applyTripMutation(mutation: TripMutation): Promise<{
  data: TripData;
  matchedEnvKey: string;
}> {
  const { data: current } = await readTripData();
  let next: TripData = current;

  switch (mutation.action) {
    case 'upsert_activity': {
      const trimmedActivity = {
        ...mutation.activity,
        history: mutation.activity.history.slice(-15),
      };
      const exists = current.activities.some(
        (a) => a.id === trimmedActivity.id
      );
      const activities = exists
        ? current.activities.map((a) =>
            a.id === trimmedActivity.id ? trimmedActivity : a
          )
        : [trimmedActivity, ...current.activities];
      next = { ...current, activities };
      break;
    }
    case 'delete_activity': {
      next = {
        ...current,
        activities: current.activities.filter((a) => a.id !== mutation.id),
      };
      break;
    }
    case 'upsert_step': {
      const exists = current.tripSteps.some((s) => s.id === mutation.step.id);
      const tripSteps = exists
        ? current.tripSteps.map((s) =>
            s.id === mutation.step.id ? mutation.step : s
          )
        : [...current.tripSteps, mutation.step];
      tripSteps.sort((a, b) => a.date.localeCompare(b.date));
      next = { ...current, tripSteps };
      break;
    }
    case 'delete_step': {
      next = {
        ...current,
        tripSteps: current.tripSteps.filter((s) => s.id !== mutation.id),
      };
      break;
    }
    case 'update_settings': {
      next = { ...current, settings: mutation.settings };
      break;
    }
    case 'replace_all': {
      next = mutation.data;
      break;
    }
  }

  const normalized = TripDataSchema.parse({
    ...next,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  });
  const { matchedEnvKey } = await writeTripData(normalized);
  return { data: normalized, matchedEnvKey };
}

/** Cache climate API responses in Redis (with TTL) so Open-Meteo is not hit repeatedly. */
export async function getRedisCache<T>(key: string): Promise<T | null> {
  try {
    const { client } = getRedis();
    const hit = await client.get<T>(key);
    return hit ?? null;
  } catch {
    return null;
  }
}

export async function setRedisCache(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  try {
    const { client } = getRedis();
    await client.set(key, value, { ex: ttlSeconds });
  } catch {
    // Non-fatal cache write error
  }
}

/** Lightweight in-memory cache for autocomplete geocode queries. */
const memoryCache = new Map<string, { expiresAt: number; payload: unknown }>();

export function getMemoryCache<T>(key: string): T | null {
  const hit = memoryCache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.payload as T;
  }
  return null;
}

export function setMemoryCache(
  key: string,
  value: unknown,
  ttlSeconds: number
): void {
  if (memoryCache.size > 200) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, {
    expiresAt: Date.now() + ttlSeconds * 1000,
    payload: value,
  });
}
