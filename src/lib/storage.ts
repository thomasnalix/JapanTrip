import { Redis } from '@upstash/redis';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createDefaultTripData,
  TripData,
  TripDataSchema,
  TripMutation,
} from './schemas';

export type StorageMode = 'upstash' | 'local-file' | 'ephemeral';

const TRIP_REDIS_KEY = 'japantrip:data:v1';
const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'trip-data.json');

let memoryFallback: TripData | null = null;

function getRedisClient(): Redis | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function getStorageMode(): StorageMode {
  if (getRedisClient()) return 'upstash';
  if (process.env.VERCEL) return 'ephemeral';
  return 'local-file';
}

export async function readTripData(): Promise<{
  data: TripData;
  storageMode: StorageMode;
}> {
  const redis = getRedisClient();
  if (redis) {
    const raw = await redis.get<unknown>(TRIP_REDIS_KEY);
    if (raw) {
      const parsed = TripDataSchema.safeParse(raw);
      if (parsed.success) {
        return { data: parsed.data, storageMode: 'upstash' };
      }
    }
    const initial = createDefaultTripData();
    await redis.set(TRIP_REDIS_KEY, initial);
    return { data: initial, storageMode: 'upstash' };
  }

  try {
    const text = await fs.readFile(LOCAL_DATA_FILE, 'utf8');
    const parsed = TripDataSchema.safeParse(JSON.parse(text));
    if (parsed.success) {
      return { data: parsed.data, storageMode: getStorageMode() };
    }
  } catch {
    // File does not exist yet or filesystem is read-only
  }

  if (memoryFallback) {
    return { data: memoryFallback, storageMode: getStorageMode() };
  }

  const initial = createDefaultTripData();
  await writeTripData(initial);
  return { data: initial, storageMode: getStorageMode() };
}

export async function writeTripData(data: TripData): Promise<StorageMode> {
  const validated = TripDataSchema.parse({
    ...data,
    updatedAt: new Date().toISOString(),
  });

  const redis = getRedisClient();
  if (redis) {
    await redis.set(TRIP_REDIS_KEY, validated);
    return 'upstash';
  }

  memoryFallback = validated;
  try {
    await fs.mkdir(path.dirname(LOCAL_DATA_FILE), { recursive: true });
    await fs.writeFile(
      LOCAL_DATA_FILE,
      JSON.stringify(validated, null, 2),
      'utf8'
    );
    return 'local-file';
  } catch {
    return 'ephemeral';
  }
}

export async function applyTripMutation(
  mutation: TripMutation
): Promise<{ data: TripData; storageMode: StorageMode }> {
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
  const storageMode = await writeTripData(normalized);
  return { data: normalized, storageMode };
}

/**
 * Process-memory only cache for geocode and climate queries.
 * Keeps Upstash Redis free plan strictly reserved for Nell & Thomas's trip data.
 */
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
  if (memoryCache.size > 250) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, {
    expiresAt: Date.now() + ttlSeconds * 1000,
    payload: value,
  });
}
