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
  pickBannerText?: string;
  focusTarget: MapFocusTarget | null;
  onMapClickCoordinates: (lat: number, lng: number) => void;
  onSelectActivity: (activity: Activity) => void;
  onMoveActivity?: (id: string, lat: number, lng: number) => void;
  onSelectStep: (step: TripStep) => void;
}

const ZONING_SOURCE_ID = 'japan-zoning-source';
const ZONING_FILL_LAYER_ID = 'japan-zoning-fill';
const ZONING_LINE_LAYER_ID = 'japan-zoning-line';
const ROUTES_SOURCE_ID = 'trip-routes-source';
const ROUTES_LAYER_ID = 'trip-routes-layer';
const ROUTES_HIT_LAYER_ID = 'trip-routes-hit-layer';

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

/**
 * Build a smooth quadratic Bezier arc for flights and return all coordinates + exact midpoint.
 */
function buildRouteGeometry(
  from: [number, number],
  to: [number, number],
  curved: boolean
): { coordinates: [number, number][]; midpoint: [number, number] } {
  if (!curved) {
    return {
      coordinates: [from, to],
      midpoint: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
    };
  }

  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dist = Math.hypot(dx, dy) || 1;
  // Perpendicular normal rotated consistently upward/westward for nice flight arcs
  let nx = -dy / dist;
  let ny = dx / dist;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const offset = Math.min(2.6, Math.max(0.35, dist * 0.22));
  const ctrl: [number, number] = [
    (from[0] + to[0]) / 2 + nx * offset,
    (from[1] + to[1]) / 2 + ny * offset,
  ];

  const segments = 32;
  const coordinates: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const inv = 1 - t;
    const lng = inv * inv * from[0] + 2 * inv * t * ctrl[0] + t * t * to[0];
    const lat = inv * inv * from[1] + 2 * inv * t * ctrl[1] + t * t * to[1];
    coordinates.push([lng, lat]);
  }
  const midpoint = coordinates[Math.floor(segments / 2)];
  return { coordinates, midpoint };
}

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
      <circle cx="20" cy="20" r="${radius}" fill="none" stroke="${trackColor}" stroke-width="3.4" />
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

function createStepLabelElement(
  step: TripStep,
  isToday: boolean
): HTMLButtonElement {
  const meta = STEP_TYPE_META[step.type];
  const fa = getFaSvgParts(STEP_ICONS[step.type]);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = `Cliquer pour modifier : ${step.title} (${step.date})`;
  btn.style.cursor = 'pointer';
  btn.className =
    'flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-white shadow-md transition hover:scale-105';
  btn.style.backgroundColor = meta.color;
  btn.style.border = isToday
    ? '2px solid #FFFFFF'
    : '1px solid rgba(255,255,255,0.85)';
  btn.style.boxShadow = isToday
    ? '0 0 0 2px #C83228, 0 4px 10px rgba(0,0,0,0.25)'
    : '0 2px 6px rgba(0,0,0,0.22)';
  btn.innerHTML = `
    <svg width="11" height="11" viewBox="0 0 ${fa.width} ${fa.height}" style="flex-shrink:0;">
      <path d="${fa.path}" fill="#FFFFFF" />
    </svg>
    <span style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${step.title}</span>
  `;
  return btn;
}

function createEndpointDotElement(
  color: string,
  title: string
): HTMLButtonElement {
  const dot = document.createElement('button');
  dot.type = 'button';
  dot.title = title;
  dot.style.width = '10px';
  dot.style.height = '10px';
  dot.style.borderRadius = '9999px';
  dot.style.backgroundColor = color;
  dot.style.border = '2px solid #FFFFFF';
  dot.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
  dot.style.cursor = 'pointer';
  return dot;
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
  pickBannerText,
  focusTarget,
  onMapClickCoordinates,
  onSelectActivity,
  onMoveActivity,
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
  const onSelectActivityRef = useRef(onSelectActivity);
  const onMoveActivityRef = useRef(onMoveActivity);
  const onSelectStepRef = useRef(onSelectStep);
  const stepsRef = useRef(steps);

  pickModeRef.current = pickMode;
  onClickCoordsRef.current = onMapClickCoordinates;
  onSelectActivityRef.current = onSelectActivity;
  onMoveActivityRef.current = onMoveActivity;
  onSelectStepRef.current = onSelectStep;
  stepsRef.current = steps;

  useEffect(() => {
    import('@/lib/japan-prefectures.json')
      .then((mod) => {
        const geo = mod.default as PrefectureCollection;
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

        // Place prefecture zoning beneath map city/place labels so text stays crisp
        const firstSymbolId = map
          .getStyle()
          .layers?.find((l) => l.type === 'symbol')?.id;

        // 47-Prefecture regional zoning choropleth
        map.addSource(ZONING_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer(
          {
            id: ZONING_FILL_LAYER_ID,
            type: 'fill',
            source: ZONING_SOURCE_ID,
            paint: {
              'fill-color': ['get', 'color'],
              'fill-opacity': 0.58,
            },
          },
          firstSymbolId
        );
        map.addLayer(
          {
            id: ZONING_LINE_LAYER_ID,
            type: 'line',
            source: ZONING_SOURCE_ID,
            paint: {
              'line-color': '#FFFFFF',
              'line-width': 1,
              'line-opacity': 0.85,
            },
          },
          firstSymbolId
        );

        // Trip planning routes (curved for flights, straight for ground/ferry)
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
            'line-width': ['case', ['get', 'isToday'], 4, 2.6],
            'line-opacity': ['case', ['get', 'reached'], 0.95, 0.45],
            'line-dasharray': [
              'case',
              ['get', 'dashed'],
              ['literal', [2.2, 1.5]],
              ['literal', [1, 0]],
            ],
          },
        });

        // Wide transparent hit layer so clicking curved/straight lines is effortless
        map.addLayer({
          id: ROUTES_HIT_LAYER_ID,
          type: 'line',
          source: ROUTES_SOURCE_ID,
          paint: {
            'line-color': '#000000',
            'line-width': 18,
            'line-opacity': 0.01,
          },
        });

        map.on('click', ROUTES_HIT_LAYER_ID, (e) => {
          if (pickModeRef.current) return;
          const stepId = e.features?.[0]?.properties?.stepId as
            | string
            | undefined;
          if (!stepId) return;
          const found = stepsRef.current.find((s) => s.id === stepId);
          if (found) onSelectStepRef.current(found);
        });

        map.on('mouseenter', ROUTES_HIT_LAYER_ID, () => {
          if (!pickModeRef.current && map) {
            map.getCanvas().style.cursor = 'pointer';
          }
        });
        map.on('mouseleave', ROUTES_HIT_LAYER_ID, () => {
          if (map) {
            map.getCanvas().style.cursor = pickModeRef.current
              ? 'crosshair'
              : '';
          }
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
        map.on('click', ZONING_FILL_LAYER_ID, (e) => {
          if (pickModeRef.current) return;
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = pickMode ? 'crosshair' : '';
  }, [pickMode, mapReady]);

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
      const isSelected = act.id === selectedActivityId;
      const el = createActivityMarkerElement(
        act,
        isSelected,
        matchesTimeline
      );
      if (isSelected) {
        el.title = `${act.name} — glisser pour déplacer`;
      }
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onSelectActivityRef.current(act);
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center',
        draggable: isSelected,
      })
        .setLngLat([act.lng, act.lat])
        .addTo(map);

      if (isSelected) {
        marker.on('dragend', () => {
          const ll = marker.getLngLat();
          if (isInsideJapan(ll.lat, ll.lng)) {
            onMoveActivityRef.current?.(act.id, ll.lat, ll.lng);
          } else {
            marker.setLngLat([act.lng, act.lat]);
          }
        });
      }

      activityMarkersRef.current.push(marker);
    }
  }, [activities, selectedActivityId, activeDate, mode, mapReady]);

  // Sync Trip Planning routes (curved flights, centered titles, clickable lines & labels)
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

      const hasDestination =
        meta.hasRoute &&
        step.toLat !== undefined &&
        step.toLng !== undefined;

      if (hasDestination) {
        const isFlight = step.type === 'flight';
        const { coordinates, midpoint } = buildRouteGeometry(
          [step.fromLng, step.fromLat],
          [step.toLng!, step.toLat!],
          isFlight
        );

        routeFeatures.push({
          type: 'Feature',
          properties: {
            stepId: step.id,
            color: meta.color,
            isToday,
            reached,
            dashed: isFlight || step.type === 'ferry',
          },
          geometry: {
            type: 'LineString',
            coordinates,
          },
        });

        // Endpoint dots
        const fromDot = createEndpointDotElement(meta.color, step.fromName);
        fromDot.addEventListener('click', (ev) => {
          ev.stopPropagation();
          onSelectStepRef.current(step);
        });
        stepMarkersRef.current.push(
          new maplibregl.Marker({ element: fromDot, anchor: 'center' })
            .setLngLat([step.fromLng, step.fromLat])
            .addTo(map)
        );

        const toDot = createEndpointDotElement(
          meta.color,
          step.toName || step.title
        );
        toDot.addEventListener('click', (ev) => {
          ev.stopPropagation();
          onSelectStepRef.current(step);
        });
        stepMarkersRef.current.push(
          new maplibregl.Marker({ element: toDot, anchor: 'center' })
            .setLngLat([step.toLng!, step.toLat!])
            .addTo(map)
        );

        // Title pill always centered in the middle of the route
        const midLabel = createStepLabelElement(step, isToday);
        midLabel.addEventListener('click', (ev) => {
          ev.stopPropagation();
          onSelectStepRef.current(step);
        });
        stepMarkersRef.current.push(
          new maplibregl.Marker({ element: midLabel, anchor: 'center' })
            .setLngLat(midpoint)
            .addTo(map)
        );
      } else {
        // Point step (stay or milestone)
        const el = createStepLabelElement(step, isToday);
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          onSelectStepRef.current(step);
        });
        stepMarkersRef.current.push(
          new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([step.fromLng, step.fromLat])
            .addTo(map)
        );
      }
    }

    routeSource?.setData({
      type: 'FeatureCollection',
      features: routeFeatures,
    });
  }, [steps, activeDate, mode, mapReady]);

  // Sync 47-prefecture regional zoning choropleth
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

      {pickMode && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-30 -translate-x-1/2 rounded-md bg-[#C83228] px-3.5 py-1.5 text-xs font-medium text-white shadow-md">
          {pickBannerText || 'Cliquez sur la carte du Japon pour placer le point'}
        </div>
      )}

      {mode === 'planning' && hoveredZone && (
        <div className="pointer-events-auto fixed bottom-24 left-2.5 right-14 z-20 rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur-md sm:bottom-auto sm:left-auto sm:right-4 sm:top-[64px]">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-zinc-900">
            <span className="truncate">{hoveredZone.name}</span>
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 rounded-md bg-[#C83228]/10 px-1.5 py-0.5 text-[#C83228]">
                {hoveredZone.valueLabel}
              </span>
              <button
                type="button"
                onClick={() => setHoveredZone(null)}
                className="text-zinc-400 hover:text-zinc-700 sm:hidden"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
          </div>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            {hoveredZone.details}
          </div>
        </div>
      )}

      <div className="fixed bottom-24 right-2.5 z-20 flex flex-col gap-1.5 sm:bottom-28 sm:right-4">
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
