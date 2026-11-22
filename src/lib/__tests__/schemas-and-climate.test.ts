import assert from 'node:assert/strict';
import test from 'node:test';
import { getTripDays, isInsideJapan } from '../japan-bounds.ts';
import { computeMomijiForDate, JAPAN_STATIONS } from '../japan-climate.ts';
import {
  ActivitySchema,
  createDefaultTripData,
  MAX_ACTIVITY_LINKS,
  TripDataSchema,
} from '../schemas.ts';

test('Japan bounds include Okinawa and Hokkaido and reject outside coordinates', () => {
  // Ishigaki (Okinawa)
  assert.equal(isInsideJapan(24.34, 124.16), true);
  // Wakkanai (Hokkaido)
  assert.equal(isInsideJapan(45.41, 141.67), true);
  // Paris (outside)
  assert.equal(isInsideJapan(48.85, 2.35), false);
});

test('getTripDays generates inclusive date range', () => {
  const days = getTripDays('2026-11-01', '2026-11-05');
  assert.deepEqual(days, [
    '2026-11-01',
    '2026-11-02',
    '2026-11-03',
    '2026-11-04',
    '2026-11-05',
  ]);
});

test('Momiji progression peaks in Kyoto around late November and stays vert in Okinawa', () => {
  const kyoto = JAPAN_STATIONS.find((s) => s.id === 'kyoto');
  const naha = JAPAN_STATIONS.find((s) => s.id === 'naha');
  assert.ok(kyoto && naha);

  const kyotoNov23 = computeMomijiForDate(kyoto, '2026-11-23');
  assert.equal(kyotoNov23.phase, 'pic');
  assert.ok(kyotoNov23.score >= 80);

  const kyotoJuly = computeMomijiForDate(kyoto, '2026-07-15');
  assert.equal(kyotoJuly.phase, 'vert');

  const nahaNov = computeMomijiForDate(naha, '2026-11-23');
  assert.equal(nahaNov.phase, 'vert');
});

test('TripData and Activity schemas enforce max 10 links and valid ratings', () => {
  const defaults = createDefaultTripData();
  assert.equal(TripDataSchema.safeParse(defaults).success, true);

  const tooManyLinks = Array.from({ length: MAX_ACTIVITY_LINKS + 1 }, (_, i) => ({
    id: `l-${i}`,
    label: `Link ${i}`,
    url: `https://example.com/${i}`,
  }));

  const badActivity = {
    id: 'a-1',
    name: 'Test Ramen',
    lat: 35.68,
    lng: 139.77,
    category: 'restaurant',
    rating: 4.5,
    links: tooManyLinks,
    createdBy: 'Nell',
    createdAt: new Date().toISOString(),
    updatedBy: 'Nell',
    updatedAt: new Date().toISOString(),
  };

  assert.equal(ActivitySchema.safeParse(badActivity).success, false);
});
