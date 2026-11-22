'use client';

import maplibregl from 'maplibre-gl';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CATEGORY_ICONS, getFaSvgParts, STEP_ICONS } from '@/lib/icons';
import {
  JAPAN_CENTER,
  JAPAN_INITIAL_BOUNDS,
  JAPAN_MAX_BOUNDS,
  isInsideJapan,
} from '@/lib/japan-bounds';
import {
  formatLayerPill,
  getLayerColor,
  interpolateClimateAt,
} from '@/lib/japan-climate';
import { getWarmJapanMapStyle } from '@/lib/map-style';
import {
  Activity,
  CATEGORY_META,
  ClimateDaySnapshot,
  STEP_TYPE_META,
  TripStep,
  WeatherLayerType,
} from '@/lib/schemas';

export type AppMode = 'activities' | 'planning';

export interface MapFocusTarget {
  lat: number;
  lng: number;
  zoom?: number;
  nonce: number;
}

interface PrefectureFeature {
  type: 'Feature';
  properties: {
    id: number;
    name: string;
    centroidLat?: number;
    centroidLng?: number;
    color?: string;
    valueLabel?: string;
    details?: string;
  };
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

interface PrefectureCollection {
  type: 'FeatureCollection';
  features: PrefectureFeature[];
}

interface JapanMapProps {
  mode: AppMode;
  activities: Activity[];
  selectedActivityId: string | null;
  steps: TripStep[];
  activeDate: string;
  activeLayer: WeatherLayerType | null;
  climateSnapshot: ClimateDaySnapshot | null;
  pickMode: boolean;
  focusTarget: MapFocusTarget | null;
  onMapClickCoordinates: (lat: number, lng: number) => void;
  onSelectActivity: (activity: Activity) => void;
  onSelectStep: (step: TripStep) => void;
}

const ZONING_SOURCE_ID = 'japan-zoning-source';
const ZONING_FILL_LAYER_ID = 'japan-zoning-fill';
const ZONING_LINE_LAYER_ID = 'japan-zoning-line';
const ROUTES_SOURCE_ID = 'trip-routes-source';
const ROUTES_LAYER_ID = 'trip-routes-layer';

function computePolygonCentroid(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
): [number, number] {
  const ring =
    geometry.type === 'Polygon'
      ? geometry.coordinates[0]
      : geometry.coordinates[0]?.[0];
  if (!ring || ring.length === 0) return [138, 36];
  let sumLng = 0;
  let sumLat = 0;
  for (const pt of ring) {
    sumLng += pt[0];
    sumLat += pt[1];
  }
  return [sumLng / ring.length, sumLat / ring.length];
}

/** Build an SVG circular rating gauge marker with a crisp Font Awesome vector icon. */
function createActivityMarkerElement(
  activity: Activity,
  isSelected: boolean,
  matchesTimelineDate: boolean
): HTMLButtonElement {
  const meta = CATEGORY_META[activity.category];
  const fa = getFaSvgParts(CATEGORY_ICONS[activity.category]);
  const ratio = Math.max(0, Math.min(1, activity.rating / 5));
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = `${activity.name} (${activity.rating}/5)`;
  btn.className = 'group relative flex items-center justify-center outline-none';
  btn.style.width = '40px';
  btn.style.height = '40px';
  btn.style.cursor = 'pointer';
  btn.style.transform = isSelected ? 'scale(1.2)' : 'scale(1)';
  btn.style.transition = 'transform 140ms ease';

  const ringColor = activity.rating > 0 ? meta.color : '#D4D4D8';
  const trackColor = '#E4E4E7';

  btn.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 40 40" style="filter: drop-shadow(0 2px 5px rgba(9,9,11,0.22));">
      <circle cx="20" cy="20" r="18" fill="#FFFFFF" />
      <circle
        cx="20" cy="20" r="${radius}"
        fill="none"
        stroke="${trackColor}"
        stroke-width="3.4"
      />
      <circle
        cx="20" cy="20" r="${radius}"
        fill="none"
        stroke="${ringColor}"
        stroke-width="3.4"
        stroke-linecap="round"
        stroke-dasharray="${circumference.toFixed(2)}"
        stroke-dashoffset="${dashOffset.toFixed(2)}"
        transform="rotate(-90 20 20)"
      />
      ${
        isSelected
          ? `<circle cx="20" cy="20" r="19" fill="none" stroke="#09090B" stroke-width="1.5" />`
          : ''
      }
      <svg x="12.5" y="12.5" width="15" height="15" viewBox="0 0 ${fa.width} ${fa.height}">
        <path d="${fa.path}" fill="${meta.color}" />
      </svg>
    </svg>
    ${
      matchesTimelineDate
        ? `<span title="Période idéale" style="position:absolute;top:0;right:0;width:9px;height:9px;border-radius:9999px;background:#C83228;border:2px solid #FFFFFF;"></span>`
        : ''
    }
  `;
  return btn;
}

function createStepMarkerElement(
  step: TripStep,
  isToday: boolean
): HTMLButtonElement {
  const meta = STEP_TYPE_META[step.type];
  const fa = getFaSvgParts(STEP_ICONS[step.type]);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = `${step.title} (${step.date})`;
  btn.style.cursor = 'pointer';
  btn.className =
    'flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-white shadow-md transition hover:scale-105';
  btn.style.backgroundColor = meta.color;
  btn.style.border = isToday
    ? '2px solid #FFFFFF'
    : '1px solid rgba(255,255,255,0.75)';
  btn.style.boxShadow = isToday
    ? '0 0 0 2px #C83228, 0 4px 10px rgba(0,0,0,0.25)'
    : '0 2px 6px rgba(0,0,0,0.2)';
  btn.innerHTML = `
    <svg width="11" height="11" viewBox="0 0 ${fa.width} ${fa.height}" style="flex-shrink:0;">
      <path d="${fa.path}" fill="#FFFFFF" />
    </svg>
    <span style="max-width:92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${step.fromName}</span>
  `;
  return btn;
}

export function JapanMap({
  mode,
  activities,
  selectedActivityId,
  steps,
  activeDate,
  activeLayer,
  climateSnapshot,
  pickMode,
  focusTarget,
  onMapClickCoordinates,
  onSelectActivity,
  onSelectStep,
}: JapanMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [prefectures, setPrefectures] = useState<PrefectureCollection | null>(
    null
  );
  const [hoveredZone, setHoveredZone] = useState<{
    name: string;
    valueLabel: string;
    details: string;
  } | null>(null);

  const activityMarkersRef = useRef<maplibregl.Marker[]>([]);
  const stepMarkersRef = useRef<maplibregl.Marker[]>([]);

  const pickModeRef = useRef(pickMode);
  const onClickCoordsRef = useRef(onMapClickCoordinates);
  pickModeRef.current = pickMode;
  onClickCoordsRef.current = onMapClickCoordinates;

  // Load 47-prefecture simplified GeoJSON once for clean regional zoning
  useEffect(() => {
    fetch('/data/japan-prefectures.json')
      .then((r) => r.json())
      .then((geo: PrefectureCollection) => {
        const enriched: PrefectureCollection = {
          type: 'FeatureCollection',
          features: geo.features.map((f) => {
            const [cLng, cLat] = computePolygonCentroid(f.geometry);
            return {
              ...f,
              properties: {
                ...f.properties,
                centroidLat: cLat,
                centroidLng: cLng,
              },
            };
          }),
        };
        setPrefectures(enriched);
      })
      .catch(() => {});
  }, []);

  // Initialize MapLibre once
  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let map: maplibregl.Map | null = null;

    (async () => {
      const style = await getWarmJapanMapStyle();
      if (disposed || !containerRef.current) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: JAPAN_CENTER,
        zoom: 4.8,
        minZoom: 4.3,
        maxZoom: 18,
        maxBounds: JAPAN_MAX_BOUNDS,
        pitchWithRotate: false,
        dragRotate: false,
      });

      map.on('load', () => {
        if (disposed || !map) return;

        map.fitBounds(JAPAN_INITIAL_BOUNDS, {
          padding: { top: 96, bottom: 105, left: 32, right: 32 },
          duration: 0,
        });

        // 47-Prefecture regional zoning choropleth source & layers
        map.addSource(ZONING_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: ZONING_FILL_LAYER_ID,
          type: 'fill',
          source: ZONING_SOURCE_ID,
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.56,
          },
        });
        map.addLayer({
          id: ZONING_LINE_LAYER_ID,
          type: 'line',
          source: ZONING_SOURCE_ID,
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 0.9,
            'line-opacity': 0.85,
          },
        });

        // Trip planning routes source/layer
        map.addSource(ROUTES_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: ROUTES_LAYER_ID,
          type: 'line',
          source: ROUTES_SOURCE_ID,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['case', ['get', 'isToday'], 4, 2.5],
            'line-opacity': ['case', ['get', 'reached'], 0.92, 0.35],
            'line-dasharray': [2, 1.4],
          },
        });

        map.on('mousemove', ZONING_FILL_LAYER_ID, (e) => {
          const props = e.features?.[0]?.properties as
            | { name?: string; valueLabel?: string; details?: string }
            | undefined;
          if (props?.name && props.valueLabel) {
            setHoveredZone({
              name: props.name,
              valueLabel: props.valueLabel,
              details: props.details ?? '',
            });
          }
        });
        map.on('mouseleave', ZONING_FILL_LAYER_ID, () => {
          setHoveredZone(null);
        });

        setMapReady(true);
      });

      map.on('click', (e) => {
        if (!pickModeRef.current) return;
        const { lat, lng } = e.lngLat;
        if (!isInsideJapan(lat, lng)) return;
        onClickCoordsRef.current(lat, lng);
      });

      mapRef.current = map;
    })();

    return () => {
      disposed = true;
      setMapReady(false);
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Cursor feedback when picking on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = pickMode ? 'crosshair' : '';
  }, [pickMode, mapReady]);

  // Smooth flyTo when selecting a search result or trip step
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focusTarget) return;
    map.flyTo({
      center: [focusTarget.lng, focusTarget.lat],
      zoom: focusTarget.zoom ?? Math.max(map.getZoom(), 12.5),
      duration: 900,
    });
  }, [focusTarget, mapReady]);

  // Sync activity markers
  useEffect(() => {
    activityMarkersRef.current.forEach((m) => m.remove());
    activityMarkersRef.current = [];

    const map = mapRef.current;
    if (!map || !mapReady || mode !== 'activities') return;

    for (const act of activities) {
      const matchesTimeline = Boolean(
        act.idealStartDate &&
          act.idealEndDate &&
          activeDate >= act.idealStartDate &&
          activeDate <= act.idealEndDate
      );
      const el = createActivityMarkerElement(
        act,
        act.id === selectedActivityId,
        matchesTimeline
      );
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onSelectActivity(act);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([act.lng, act.lat])
        .addTo(map);
      activityMarkersRef.current.push(marker);
    }
  }, [
    activities,
    selectedActivityId,
    activeDate,
    mode,
    mapReady,
    onSelectActivity,
  ]);

  // Sync Trip Planning routes & step markers
  useEffect(() => {
    stepMarkersRef.current.forEach((m) => m.remove());
    stepMarkersRef.current = [];

    const map = mapRef.current;
    if (!map || !mapReady) return;

    const routeSource = map.getSource(ROUTES_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;

    if (mode !== 'planning') {
      routeSource?.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const routeFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];

    for (const step of steps) {
      const meta = STEP_TYPE_META[step.type];
      const isToday =
        step.date === activeDate ||
        (Boolean(step.endDate) &&
          activeDate >= step.date &&
          activeDate <= (step.endDate ?? step.date));
      const reached = step.date <= activeDate;

      if (
        meta.hasRoute &&
        step.toLat !== undefined &&
        step.toLng !== undefined
      ) {
        routeFeatures.push({
          type: 'Feature',
          properties: {
            color: meta.color,
            isToday,
            reached,
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [step.fromLng, step.fromLat],
              [step.toLng, step.toLat],
            ],
          },
        });
      }

      const el = createStepMarkerElement(step, isToday);
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onSelectStep(step);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([step.fromLng, step.fromLat])
        .addTo(map);
      stepMarkersRef.current.push(marker);
    }

    routeSource?.setData({
      type: 'FeatureCollection',
      features: routeFeatures,
    });
  }, [steps, activeDate, mode, mapReady, onSelectStep]);

  // Sync 47-prefecture regional zoning choropleth layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const zoningSource = map.getSource(ZONING_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;

    if (
      mode !== 'planning' ||
      !activeLayer ||
      !climateSnapshot ||
      !prefectures
    ) {
      setHoveredZone(null);
      zoningSource?.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const features: PrefectureFeature[] = prefectures.features.map((f) => {
      const cLat = f.properties.centroidLat ?? 36;
      const cLng = f.properties.centroidLng ?? 138;
      const val = interpolateClimateAt(cLat, cLng, climateSnapshot.stations);
      const color = getLayerColor(activeLayer, val);
      const valueLabel = formatLayerPill(activeLayer, val);
      const details = `${val.tempMeanC}°C • Pluie ${val.precipitationMm}mm • Neige ${val.snowfallCm}cm • Momiji ${val.momijiScore}%`;

      return {
        ...f,
        properties: {
          ...f.properties,
          color,
          valueLabel,
          details,
        },
      };
    });

    zoningSource?.setData({
      type: 'FeatureCollection',
      features: features as unknown as GeoJSON.Feature[],
    });
  }, [mode, activeLayer, climateSnapshot, prefectures, mapReady]);

  function handleResetJapanView() {
    mapRef.current?.fitBounds(JAPAN_INITIAL_BOUNDS, {
      padding: { top: 96, bottom: 105, left: 32, right: 32 },
      duration: 750,
    });
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Pick-on-map helper banner */}
      {pickMode && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-30 -translate-x-1/2 rounded-md bg-[#C83228] px-3.5 py-1.5 text-xs font-medium text-white shadow-md">
          Cliquez sur la carte du Japon pour placer le point
        </div>
      )}

      {/* Prefecture zoning hover tooltip */}
      {mode === 'planning' && hoveredZone && (
        <div className="pointer-events-none fixed right-3 top-[64px] z-20 rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur-md sm:right-4">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-zinc-900">
            <span>{hoveredZone.name}</span>
            <span className="rounded-md bg-[#C83228]/10 px-1.5 py-0.5 text-[#C83228]">
              {hoveredZone.valueLabel}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            {hoveredZone.details}
          </div>
        </div>
      )}

      {/* Zoom + Recenter Japan controls */}
      <div className="fixed bottom-28 right-3 z-20 flex flex-col gap-1.5 sm:right-4">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn({ duration: 220 })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white/95 text-zinc-800 shadow-sm backdrop-blur-md transition hover:bg-zinc-100"
          title="Zoomer"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut({ duration: 220 })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white/95 text-zinc-800 shadow-sm backdrop-blur-md transition hover:bg-zinc-100"
          title="Dézoomer"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleResetJapanView}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white/95 text-[#C83228] shadow-sm backdrop-blur-md transition hover:bg-zinc-100"
          title="Vue complète du Japon"
        >
          <LocateFixed className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
