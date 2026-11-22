import type {
  ClimateDaySnapshot,
  ClimateStationValue,
  WeatherLayerType,
} from './schemas';
import { parseISODate } from './japan-bounds.ts';

export interface JapanStation {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  /** Typical Momiji peak day-of-year (1..365). null for subtropical islands with minimal autumn foliage. */
  momijiPeakDoy: number | null;
  /** Approximate November baseline temperature (°C) used only if Open-Meteo is offline. */
  baselineNovTempC: number;
}

// 28 stations spanning Okinawa -> Kyushu -> Shikoku -> Honshu -> Hokkaido
export const JAPAN_STATIONS: JapanStation[] = [
  { id: 'ishigaki', name: 'Ishigaki', region: 'Okinawa', lat: 24.34, lng: 124.16, momijiPeakDoy: null, baselineNovTempC: 23.0 },
  { id: 'naha', name: 'Naha', region: 'Okinawa', lat: 26.21, lng: 127.68, momijiPeakDoy: null, baselineNovTempC: 21.8 },
  { id: 'kagoshima', name: 'Kagoshima', region: 'Kyushu', lat: 31.59, lng: 130.56, momijiPeakDoy: 334, baselineNovTempC: 15.2 },
  { id: 'kumamoto', name: 'Kumamoto', region: 'Kyushu', lat: 32.80, lng: 130.71, momijiPeakDoy: 328, baselineNovTempC: 13.6 },
  { id: 'nagasaki', name: 'Nagasaki', region: 'Kyushu', lat: 32.75, lng: 129.88, momijiPeakDoy: 330, baselineNovTempC: 14.3 },
  { id: 'fukuoka', name: 'Fukuoka', region: 'Kyushu', lat: 33.59, lng: 130.40, momijiPeakDoy: 327, baselineNovTempC: 13.8 },
  { id: 'hiroshima', name: 'Hiroshima', region: 'Chugoku', lat: 34.39, lng: 132.46, momijiPeakDoy: 322, baselineNovTempC: 12.8 },
  { id: 'matsuyama', name: 'Matsuyama', region: 'Shikoku', lat: 33.84, lng: 132.77, momijiPeakDoy: 325, baselineNovTempC: 13.4 },
  { id: 'takamatsu', name: 'Takamatsu', region: 'Shikoku', lat: 34.34, lng: 134.05, momijiPeakDoy: 324, baselineNovTempC: 12.9 },
  { id: 'osaka', name: 'Osaka', region: 'Kansai', lat: 34.69, lng: 135.50, momijiPeakDoy: 330, baselineNovTempC: 13.3 },
  { id: 'kyoto', name: 'Kyoto', region: 'Kansai', lat: 35.01, lng: 135.77, momijiPeakDoy: 327, baselineNovTempC: 12.1 },
  { id: 'nara', name: 'Nara', region: 'Kansai', lat: 34.68, lng: 135.80, momijiPeakDoy: 326, baselineNovTempC: 11.9 },
  { id: 'nagoya', name: 'Nagoya', region: 'Chubu', lat: 35.18, lng: 136.91, momijiPeakDoy: 328, baselineNovTempC: 12.6 },
  { id: 'shizuoka', name: 'Shizuoka', region: 'Chubu', lat: 34.98, lng: 138.38, momijiPeakDoy: 332, baselineNovTempC: 14.0 },
  { id: 'fuji', name: 'Kawaguchiko', region: 'Mont Fuji', lat: 35.50, lng: 138.76, momijiPeakDoy: 313, baselineNovTempC: 7.4 },
  { id: 'tokyo', name: 'Tokyo', region: 'Kanto', lat: 35.68, lng: 139.77, momijiPeakDoy: 332, baselineNovTempC: 12.9 },
  { id: 'nikko', name: 'Nikko', region: 'Kanto Nord', lat: 36.75, lng: 139.60, momijiPeakDoy: 304, baselineNovTempC: 6.2 },
  { id: 'nagano', name: 'Nagano', region: 'Alpes', lat: 36.65, lng: 138.19, momijiPeakDoy: 309, baselineNovTempC: 7.1 },
  { id: 'takayama', name: 'Takayama', region: 'Alpes', lat: 36.14, lng: 137.25, momijiPeakDoy: 308, baselineNovTempC: 6.8 },
  { id: 'kanazawa', name: 'Kanazawa', region: 'Hokuriku', lat: 36.56, lng: 136.66, momijiPeakDoy: 321, baselineNovTempC: 11.2 },
  { id: 'niigata', name: 'Niigata', region: 'Hokuriku', lat: 37.92, lng: 139.04, momijiPeakDoy: 317, baselineNovTempC: 10.1 },
  { id: 'sendai', name: 'Sendai', region: 'Tohoku', lat: 38.27, lng: 140.87, momijiPeakDoy: 315, baselineNovTempC: 9.2 },
  { id: 'morioka', name: 'Morioka', region: 'Tohoku', lat: 39.70, lng: 141.15, momijiPeakDoy: 305, baselineNovTempC: 6.1 },
  { id: 'aomori', name: 'Aomori', region: 'Tohoku', lat: 40.82, lng: 140.75, momijiPeakDoy: 307, baselineNovTempC: 6.4 },
  { id: 'hakodate', name: 'Hakodate', region: 'Hokkaido', lat: 41.77, lng: 140.73, momijiPeakDoy: 304, baselineNovTempC: 5.5 },
  { id: 'sapporo', name: 'Sapporo', region: 'Hokkaido', lat: 43.06, lng: 141.35, momijiPeakDoy: 300, baselineNovTempC: 4.3 },
  { id: 'asahikawa', name: 'Asahikawa', region: 'Hokkaido', lat: 43.77, lng: 142.36, momijiPeakDoy: 292, baselineNovTempC: 2.3 },
  { id: 'wakkanai', name: 'Wakkanai', region: 'Hokkaido', lat: 45.41, lng: 141.67, momijiPeakDoy: 290, baselineNovTempC: 3.1 },
];

export interface LayerMeta {
  id: WeatherLayerType;
  label: string;
  shortLabel: string;
  unit: string;
  description: string;
  stops: { label: string; color: string }[];
}

export const WEATHER_LAYERS: Record<WeatherLayerType, LayerMeta> = {
  temperature: {
    id: 'temperature',
    label: 'Température',
    shortLabel: 'Temp.',
    unit: '°C',
    description: 'Température moyenne journalière prévue ou historique',
    stops: [
      { label: '≤ 0°C', color: '#3B6EA5' },
      { label: '8°C', color: '#6FB3B8' },
      { label: '16°C', color: '#E8B84B' },
      { label: '≥ 24°C', color: '#D95338' },
    ],
  },
  momiji: {
    id: 'momiji',
    label: 'Momiji (紅葉)',
    shortLabel: 'Momiji',
    unit: '%',
    description: "Progression saisonnière des érables rouges d'automne",
    stops: [
      { label: 'Vert', color: '#4D7C5B' },
      { label: 'Début', color: '#E89B3C' },
      { label: 'Pic', color: '#C83228' },
      { label: 'Fin', color: '#7D4E38' },
    ],
  },
  snow: {
    id: 'snow',
    label: 'Neige',
    shortLabel: 'Neige',
    unit: 'cm',
    description: 'Cumul journalier de neige (Hokkaido & Alpes japonaises)',
    stops: [
      { label: '0 cm', color: '#CBD5E1' },
      { label: '2 cm', color: '#7DD3FC' },
      { label: '8 cm', color: '#38BDF8' },
      { label: '≥ 20 cm', color: '#1D4ED8' },
    ],
  },
  precipitation: {
    id: 'precipitation',
    label: 'Précipitations',
    shortLabel: 'Pluie',
    unit: 'mm',
    description: 'Précipitations journalières totales',
    stops: [
      { label: 'Sec', color: '#E7D8C3' },
      { label: '3 mm', color: '#64B5CD' },
      { label: '12 mm', color: '#2B7A9E' },
      { label: '≥ 25 mm', color: '#1E3A8A' },
    ],
  },
};

export function dayOfYear(dateStr: string): number {
  const d = parseISODate(dateStr);
  if (!d) return 180;
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86_400_000);
}

/**
 * Compute realistic Momiji progression (0..100) for a Japanese station on a given calendar date.
 * - Peak window lasts roughly +/- 9 days around `momijiPeakDoy`
 * - Turning phase starts ~22 days before peak
 * - Leaves drop ~18 days after peak
 */
export function computeMomijiForDate(
  station: JapanStation,
  dateStr: string
): { score: number; phase: 'vert' | 'debut' | 'pic' | 'fin' } {
  if (station.momijiPeakDoy === null) {
    return { score: 0, phase: 'vert' };
  }
  const doy = dayOfYear(dateStr);
  const diff = doy - station.momijiPeakDoy;

  if (diff < -24) {
    return { score: 5, phase: 'vert' };
  }
  if (diff < -7) {
    const score = Math.round(((diff + 24) / 17) * 65 + 10);
    return { score: Math.min(75, Math.max(10, score)), phase: 'debut' };
  }
  if (diff <= 8) {
    const closeness = 1 - Math.abs(diff) / 10;
    const score = Math.round(80 + closeness * 20);
    return { score: Math.min(100, Math.max(80, score)), phase: 'pic' };
  }
  if (diff <= 24) {
    const score = Math.max(8, Math.round(75 - ((diff - 8) / 16) * 67));
    return { score, phase: 'fin' };
  }
  return { score: 0, phase: 'vert' };
}

export function getLayerColor(
  layer: WeatherLayerType,
  station: ClimateStationValue
): string {
  switch (layer) {
    case 'temperature': {
      const t = station.tempMeanC;
      if (t <= 2) return '#3B6EA5';
      if (t <= 9) return '#6FB3B8';
      if (t <= 16) return '#E8B84B';
      if (t <= 22) return '#E67E45';
      return '#D95338';
    }
    case 'momiji': {
      if (station.momijiPhase === 'pic') return '#C83228';
      if (station.momijiPhase === 'debut') return '#E89B3C';
      if (station.momijiPhase === 'fin') return '#8A523B';
      return '#6D9B58';
    }
    case 'snow': {
      const s = station.snowfallCm;
      if (s <= 0.1) return '#94A3B8';
      if (s < 3) return '#60A5FA';
      if (s < 10) return '#2563EB';
      return '#1E3A8A';
    }
    case 'precipitation': {
      const p = station.precipitationMm;
      if (p < 1) return '#C9B396';
      if (p < 5) return '#64B5CD';
      if (p < 15) return '#2B7A9E';
      return '#1E3A8A';
    }
  }
}

export function formatLayerPill(
  layer: WeatherLayerType,
  station: Pick<
    ClimateStationValue,
    'tempMeanC' | 'momijiPhase' | 'momijiScore' | 'snowfallCm' | 'precipitationMm'
  >
): string {
  switch (layer) {
    case 'temperature':
      return `${station.tempMeanC.toFixed(1)} °C`;
    case 'momiji':
      if (station.momijiPhase === 'pic') return `Pic (${station.momijiScore}%)`;
      if (station.momijiPhase === 'debut') return `Début (${station.momijiScore}%)`;
      if (station.momijiPhase === 'fin') return `Fin (${station.momijiScore}%)`;
      return 'Vert';
    case 'snow':
      return `${station.snowfallCm.toFixed(1)} cm`;
    case 'precipitation':
      return `${station.precipitationMm.toFixed(1)} mm`;
  }
}

/**
 * Inverse-distance weighted interpolation at any (lat, lng) across Japan
 * so each prefecture polygon gets a smooth regional value.
 */
export function interpolateClimateAt(
  lat: number,
  lng: number,
  stations: ClimateStationValue[]
): ClimateStationValue {
  let weightSum = 0;
  let tempMean = 0;
  let tempMin = 0;
  let tempMax = 0;
  let precip = 0;
  let snow = 0;
  let momijiScore = 0;

  for (const st of stations) {
    const d2 = (lat - st.lat) ** 2 + (lng - st.lng) ** 2;
    const w = 1 / Math.max(0.002, d2);
    weightSum += w;
    tempMean += st.tempMeanC * w;
    tempMin += st.tempMinC * w;
    tempMax += st.tempMaxC * w;
    precip += st.precipitationMm * w;
    snow += st.snowfallCm * w;
    momijiScore += st.momijiScore * w;
  }

  const mScore = Math.round(momijiScore / weightSum);
  let momijiPhase: ClimateStationValue['momijiPhase'] = 'vert';
  if (mScore >= 78) momijiPhase = 'pic';
  else if (mScore >= 35) momijiPhase = 'debut';
  else if (mScore >= 12) momijiPhase = 'fin';

  return {
    id: 'zone',
    name: 'Zone',
    region: '',
    lat,
    lng,
    tempMeanC: Math.round((tempMean / weightSum) * 10) / 10,
    tempMinC: Math.round((tempMin / weightSum) * 10) / 10,
    tempMaxC: Math.round((tempMax / weightSum) * 10) / 10,
    precipitationMm: Math.round((precip / weightSum) * 10) / 10,
    snowfallCm: Math.round((snow / weightSum) * 10) / 10,
    momijiScore: mScore,
    momijiPhase,
  };
}

interface OpenMeteoSingleResponse {
  daily?: {
    time: string[];
    temperature_2m_mean?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_sum?: (number | null)[];
    snowfall_sum?: (number | null)[];
  };
}

function shiftDateToYear(dateStr: string, targetYear: number): string {
  const [, m, d] = dateStr.split('-');
  // Guard Feb 29 on non-leap years
  const safeDay = m === '02' && d === '29' ? '28' : d;
  return `${targetYear}-${m}-${safeDay}`;
}

function buildFallbackSnapshots(dates: string[]): ClimateDaySnapshot[] {
  return dates.map((date) => {
    const doy = dayOfYear(date);
    // Simple seasonal cosine offset relative to November (~doy 315)
    const seasonalOffset = Math.cos(((doy - 210) / 365) * 2 * Math.PI) * -9.5;
    const novOffset = Math.cos(((315 - 210) / 365) * 2 * Math.PI) * -9.5;
    const delta = seasonalOffset - novOffset;

    const stations: ClimateStationValue[] = JAPAN_STATIONS.map((st) => {
      const tempMean = Math.round((st.baselineNovTempC + delta) * 10) / 10;
      const momiji = computeMomijiForDate(st, date);
      const isCold = tempMean < 2.5;
      return {
        id: st.id,
        name: st.name,
        region: st.region,
        lat: st.lat,
        lng: st.lng,
        tempMeanC: tempMean,
        tempMinC: Math.round((tempMean - 4) * 10) / 10,
        tempMaxC: Math.round((tempMean + 4.5) * 10) / 10,
        precipitationMm: 2.0,
        snowfallCm: isCold && st.lat > 36 ? 3.5 : 0,
        momijiScore: momiji.score,
        momijiPhase: momiji.phase,
      };
    });

    return {
      date,
      source: 'normals',
      referenceYear: new Date().getUTCFullYear(),
      stations,
    };
  });
}

/**
 * Fetch daily weather for all 28 Japanese stations across `dates` from Open-Meteo in one single batch call.
 * Uses forecast when dates are within the next 14 days, otherwise uses the most recent completed archive year.
 */
export async function fetchJapanClimateSeries(
  dates: string[]
): Promise<ClimateDaySnapshot[]> {
  if (dates.length === 0) return [];

  const firstDate = parseISODate(dates[0]);
  const lastDate = parseISODate(dates[dates.length - 1]);
  if (!firstDate || !lastDate) return buildFallbackSnapshots(dates);

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const maxForecastMs = todayUtc + 14 * 86_400_000;

  const useForecast =
    firstDate.getTime() >= todayUtc - 86_400_000 &&
    lastDate.getTime() <= maxForecastMs;

  // For future/past trip planning outside the 14-day forecast window, query the previous year's exact calendar dates.
  const archiveYear =
    lastDate.getTime() < todayUtc - 5 * 86_400_000
      ? lastDate.getUTCFullYear()
      : now.getUTCFullYear() - 1;

  const queryStart = useForecast
    ? dates[0]
    : shiftDateToYear(dates[0], archiveYear);
  const queryEnd = useForecast
    ? dates[dates.length - 1]
    : shiftDateToYear(dates[dates.length - 1], archiveYear);

  const lats = JAPAN_STATIONS.map((s) => s.lat.toFixed(2)).join(',');
  const lngs = JAPAN_STATIONS.map((s) => s.lng.toFixed(2)).join(',');

  const baseUrl = useForecast
    ? 'https://api.open-meteo.com/v1/forecast'
    : 'https://archive-api.open-meteo.com/v1/archive';

  const params = new URLSearchParams({
    latitude: lats,
    longitude: lngs,
    start_date: queryStart,
    end_date: queryEnd,
    daily:
      'temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum',
    timezone: 'Asia/Tokyo',
  });

  try {
    const res = await fetch(`${baseUrl}?${params.toString()}`, {
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) {
      return buildFallbackSnapshots(dates);
    }

    const raw = (await res.json()) as
      | OpenMeteoSingleResponse[]
      | OpenMeteoSingleResponse;
    const list = Array.isArray(raw) ? raw : [raw];
    if (list.length !== JAPAN_STATIONS.length) {
      return buildFallbackSnapshots(dates);
    }

    return dates.map((tripDate, idx) => {
      const targetQueryDate = useForecast
        ? tripDate
        : shiftDateToYear(tripDate, archiveYear);

      const stations: ClimateStationValue[] = JAPAN_STATIONS.map((st, sIdx) => {
        const daily = list[sIdx]?.daily;
        const tIdx = daily?.time?.indexOf(targetQueryDate) ?? idx;
        const safeIdx = tIdx >= 0 ? tIdx : Math.min(idx, (daily?.time?.length ?? 1) - 1);

        const tempMean = daily?.temperature_2m_mean?.[safeIdx] ?? st.baselineNovTempC;
        const tempMin = daily?.temperature_2m_min?.[safeIdx] ?? tempMean - 4;
        const tempMax = daily?.temperature_2m_max?.[safeIdx] ?? tempMean + 4;
        const precip = daily?.precipitation_sum?.[safeIdx] ?? 0;
        const snow = daily?.snowfall_sum?.[safeIdx] ?? 0;
        const momiji = computeMomijiForDate(st, tripDate);

        return {
          id: st.id,
          name: st.name,
          region: st.region,
          lat: st.lat,
          lng: st.lng,
          tempMeanC: Math.round(tempMean * 10) / 10,
          tempMinC: Math.round(tempMin * 10) / 10,
          tempMaxC: Math.round(tempMax * 10) / 10,
          precipitationMm: Math.round(precip * 10) / 10,
          snowfallCm: Math.round(snow * 10) / 10,
          momijiScore: momiji.score,
          momijiPhase: momiji.phase,
        };
      });

      return {
        date: tripDate,
        source: useForecast ? 'forecast' : 'archive',
        referenceYear: useForecast ? firstDate.getUTCFullYear() : archiveYear,
        stations,
      };
    });
  } catch {
    return buildFallbackSnapshots(dates);
  }
}
