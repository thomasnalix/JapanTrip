import { NextRequest, NextResponse } from 'next/server';
import { getTripDays } from '@/lib/japan-bounds';
import { fetchJapanClimateSeries } from '@/lib/japan-climate';
import type { ClimateDaySnapshot } from '@/lib/schemas';
import { getRedisCache, setRedisCache } from '@/lib/storage';

export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get('start') ?? '2026-11-01';
  const end = req.nextUrl.searchParams.get('end') ?? '2026-11-22';

  const days = getTripDays(start, end);
  const cacheKey = `japantrip:climate:v2:${days[0]}:${days[days.length - 1]}`;

  const cached = await getRedisCache<ClimateDaySnapshot[]>(cacheKey);
  if (cached) {
    return NextResponse.json(
      { snapshots: cached, cached: true },
      { headers: { 'Cache-Control': 'public, max-age=10800' } }
    );
  }

  const snapshots = await fetchJapanClimateSeries(days);
  const isForecast = snapshots[0]?.source === 'forecast';
  const ttlSeconds = isForecast ? 60 * 60 * 3 : 60 * 60 * 24;

  if (snapshots.length > 0 && snapshots[0]?.source !== 'normals') {
    await setRedisCache(cacheKey, snapshots, ttlSeconds);
  }

  return NextResponse.json(
    { snapshots, cached: false },
    { headers: { 'Cache-Control': `public, max-age=${ttlSeconds}` } }
  );
}
