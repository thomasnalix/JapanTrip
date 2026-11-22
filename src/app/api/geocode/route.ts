import { NextRequest, NextResponse } from 'next/server';
import { isInsideJapan } from '@/lib/japan-bounds';
import type { Category, SearchPlaceResult } from '@/lib/schemas';
import { getMemoryCache, setMemoryCache } from '@/lib/storage';

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    name?: string;
    city?: string;
    state?: string;
    county?: string;
    street?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
  };
}

interface NominatimItem {
  place_id: number;
  display_name: string;
  name?: string;
  namedetails?: Record<string, string>;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
}

function guessCategory(key?: string, value?: string): Category {
  const k = (key ?? '').toLowerCase();
  const v = (value ?? '').toLowerCase();
  if (v.includes('restaurant') || v.includes('fast_food') || v.includes('food')) {
    return 'restaurant';
  }
  if (v.includes('cafe') || v.includes('bar') || v.includes('pub') || v.includes('bakery')) {
    return 'cafe';
  }
  if (
    v.includes('temple') ||
    v.includes('shrine') ||
    v.includes('place_of_worship') ||
    v.includes('museum') ||
    v.includes('castle') ||
    k === 'historic'
  ) {
    return 'temple';
  }
  if (
    v.includes('park') ||
    v.includes('peak') ||
    v.includes('garden') ||
    v.includes('viewpoint') ||
    v.includes('waterfall') ||
    k === 'natural'
  ) {
    return 'nature';
  }
  if (
    k === 'shop' ||
    v.includes('mall') ||
    v.includes('department_store') ||
    v.includes('market')
  ) {
    return 'shopping';
  }
  if (
    v.includes('hotel') ||
    v.includes('hostel') ||
    v.includes('ryokan') ||
    v.includes('guest_house')
  ) {
    return 'hotel';
  }
  if (
    k === 'railway' ||
    k === 'aeroway' ||
    v.includes('station') ||
    v.includes('airport') ||
    v.includes('ferry')
  ) {
    return 'transport';
  }
  if (
    v.includes('onsen') ||
    v.includes('hot_spring') ||
    v.includes('spring') ||
    v.includes('theme_park') ||
    v.includes('spa') ||
    k === 'leisure'
  ) {
    return 'experience';
  }
  return 'other';
}

/** Build fallback English/Romanized query variants when a natural POI phrase has descriptive words. */
function buildQueryVariants(raw: string): string[] {
  const variants = [raw];
  const stripped = raw
    .replace(/\b(open[-\s]?air|outdoor|indoor|free|public|famous|best)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped && stripped.toLowerCase() !== raw.toLowerCase()) {
    variants.push(stripped);
  }
  if (/\bonsen\b/i.test(stripped)) {
    variants.push(stripped.replace(/\bonsen\b/gi, 'hot spring'));
  }
  return variants.slice(0, 3);
}

async function queryPhoton(q: string): Promise<SearchPlaceResult[]> {
  try {
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', q);
    url.searchParams.set('lang', 'en');
    url.searchParams.set('limit', '8');
    url.searchParams.set('bbox', '122.5,23.5,146.5,46.0');
    url.searchParams.set('lat', '36.2');
    url.searchParams.set('lon', '138.2');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'JapanTripPlanner/1.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];

    const json = (await res.json()) as { features?: PhotonFeature[] };
    return (json.features ?? [])
      .map((f, idx): SearchPlaceResult | null => {
        const coords = f.geometry?.coordinates;
        const p = f.properties;
        if (!coords || !p) return null;
        const [lng, lat] = coords;
        if (!isInsideJapan(lat, lng)) return null;
        if (p.countrycode && p.countrycode.toUpperCase() !== 'JP') return null;

        const name = p.name || p.street || p.city || q;
        const addressParts = [p.street, p.city || p.county, p.state]
          .filter(Boolean)
          .filter((v, i, arr) => arr.indexOf(v) === i);
        const address = addressParts.join(', ') || 'Japan';
        const description = [p.osm_value?.replace(/_/g, ' '), address]
          .filter(Boolean)
          .join(' • ');

        return {
          id: `photon-${p.osm_id ?? idx}-${lat.toFixed(4)}`,
          name,
          description,
          address,
          lat,
          lng,
          suggestedCategory: guessCategory(p.osm_key, p.osm_value),
        };
      })
      .filter((x): x is SearchPlaceResult => x !== null);
  } catch {
    return [];
  }
}

async function queryNominatim(q: string): Promise<SearchPlaceResult[]> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('countrycodes', 'jp');
    url.searchParams.set('namedetails', '1');
    url.searchParams.set('limit', '6');
    url.searchParams.set('accept-language', 'en,fr');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'JapanTripPlanner/1.0 (personal-trip-app)' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];

    const items = (await res.json()) as NominatimItem[];
    return items
      .map((item): SearchPlaceResult | null => {
        const lat = Number(item.lat);
        const lng = Number(item.lon);
        if (!isInsideJapan(lat, lng)) return null;
        const latinName =
          item.namedetails?.['name:en'] ||
          item.namedetails?.['name:fr'] ||
          item.namedetails?.['name:ja-Latn'] ||
          item.namedetails?.['int_name'] ||
          item.name ||
          item.display_name.split(',')[0]?.trim() ||
          q;

        return {
          id: `nom-${item.place_id}`,
          name: latinName,
          description: item.display_name,
          address: item.display_name,
          lat,
          lng,
          suggestedCategory: guessCategory(item.class, item.type),
        };
      })
      .filter((x): x is SearchPlaceResult => x !== null);
  } catch {
    return [];
  }
}

function deduplicatePlaces(items: SearchPlaceResult[]): SearchPlaceResult[] {
  const seen = new Set<string>();
  const out: SearchPlaceResult[] = [];
  for (const item of items) {
    const key = `${item.name.toLowerCase()}:${item.lat.toFixed(2)}:${item.lng.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, 8);
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const cacheKey = `geocode:v2:${q.toLowerCase()}`;
  const cached = getMemoryCache<SearchPlaceResult[]>(cacheKey);
  if (cached) {
    return NextResponse.json(
      { results: cached },
      { headers: { 'Cache-Control': 'public, max-age=3600' } }
    );
  }

  const variants = buildQueryVariants(q);
  let collected: SearchPlaceResult[] = [];

  for (const variant of variants) {
    const [photonRes, nomRes] = await Promise.all([
      queryPhoton(variant),
      queryNominatim(variant),
    ]);
    collected = deduplicatePlaces([...nomRes, ...photonRes]);
    if (collected.length > 0) break;
  }

  if (collected.length > 0) {
    setMemoryCache(cacheKey, collected, 60 * 60 * 24);
  }

  return NextResponse.json(
    { results: collected },
    { headers: { 'Cache-Control': 'public, max-age=1800' } }
  );
}
