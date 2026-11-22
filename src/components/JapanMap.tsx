'use client';

import { LocateFixed, Minus, Plus } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import {
  JAPAN_CENTER,
  JAPAN_INITIAL_BOUNDS,
  JAPAN_MAX_BOUNDS,
  isInsideJapan,
} from '@/lib/japan-bounds';
import { formatLayerPill, getLayerColor } from '@/lib/japan-climate';
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

const ROUTES_SOURCE_ID = 'trip-routes-source';
const ROUTES_LAYER_ID = 'trip-routes-layer';
const CLIMATE_SOURCE_ID = 'climate-glow-source';
const CLIMATE_LAYER_ID = 'climate-glow-layer';

/** Build an SVG circular rating gauge marker DOM element for an activity. */
function createActivityMarkerElement(
  activity: Activity,
  isSelected: boolean,
  matchesTimelineDate: boolean
): HTMLButtonElement {
  const meta = CATEGORY_META[activity.category];
  const ratio = Math.max(0, Math.min(1, activity.rating / 5));
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = `${activity.name} (${activity.rating}/5)`;
  btn.className = 'group relative flex items-center justify-center outline-none';
  btn.style.width = '42px';
  btn.style.height = '42px';
  btn.style.cursor = 'pointer';
  btn.style.transform = isSelected ? 'scale(1.22)' : 'scale(1)';
  btn.style.transition = 'transform 150ms ease';

  const ringColor = activity.rating > 0 ? meta.color : '#C9B8A6';
  const trackColor = '#EDE2D4';

  btn.innerHTML = `
    <svg width="42" height="42" viewBox="0 0 42 42" style="filter: drop-shadow(0 3px 6px rgba(59,43,34,0.22));">
      <circle cx="21" cy="21" r="19" fill="#FDF9F2" />
      <circle
        cx="21" cy="21" r="${radius}"
        fill="none"
        stroke="${trackColor}"
        stroke-width="3.6"
      />
      <circle
        cx="21" cy="21" r="${radius}"
        fill="none"
        stroke="${ringColor}"
        stroke-width="3.6"
        stroke-linecap="round"
        stroke-dasharray="${circumference.toFixed(2)}"
        stroke-dashoffset="${dashOffset.toFixed(2)}"
        transform="rotate(-90 21 21)"
      />
      ${
        isSelected
          ? `<circle cx="21" cy="21" r="20" fill="none" stroke="#3B2B22" stroke-width="1.6" />`
          : ''
      }
    </svg>
    <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1;">
      ${meta.emoji}
    </span>
    ${
      matchesTimelineDate
        ? `<span title="Période idéale !" style="position:absolute;top:0;right:0;width:10px;height:10px;border-radius:9999px;background:#EAB308;border:2px solid #FDF9F2;"></span>`
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
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = `${step.title} (${step.date})`;
  btn.style.cursor = 'pointer';
  btn.className = 'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-white shadow-md transition hover:scale-105';
  btn.style.backgroundColor = meta.color;
  btn.style.border = isToday ? '2.5px solid #FDF9F2' : '1.5px solid rgba(255,255,255,0.85)';
  btn.style.boxShadow = isToday
    ? '0 0 0 3px rgba(217,83,56,0.45), 0 4px 10px rgba(0,0,0,0.25)'
    : '0 3px 8px rgba(0,0,0,0.22)';
  btn.innerHTML = `<span>${meta.emoji}</span><span style="max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;">${step.fromName}</span>`;
  return btn;
}

function createClimatePillElement(
  layer: WeatherLayerType,
  station: ClimateDaySnapshot['stations'][number]
): HTMLDivElement {
  const el = document.createElement('div');
  const color = getLayerColor(layer, station);
  const label = formatLayerPill(layer, station);
  el.title = `${station.name} (${station.region}) — ${station.tempMeanC}°C | Pluie ${station.precipitationMm}mm | Neige ${station.snowfallCm}cm | Momiji ${station.momijiScore}%`;
  el.style.backgroundColor = color;
  el.style.color = '#FFFFFF';
  el.style.border = '1.5px solid rgba(253,249,242,0.92)';
  el.style.borderRadius = '9999px';
  el.style.padding = '2px 7px';
  el.style.fontSize = '11px';
  el.style.fontWeight = '700';
  el.style.lineHeight = '1.25';
  el.style.boxShadow = '0 2px 6px rgba(30,20,15,0.22)';
  el.style.whiteSpace = 'nowrap';
  el.style.pointerEvents = 'auto';
  el.textContent = `${station.name} ${label}`;
  return el;
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

  const activityMarkersRef = useRef<maplibregl.Marker[]>([]);
  const stepMarkersRef = useRef<maplibregl.Marker[]>([]);
  const climateMarkersRef = useRef<maplibregl.Marker[]>([]);

  const pickModeRef = useRef(pickMode);
  const onClickCoordsRef = useRef(onMapClickCoordinates);
  pickModeRef.current = pickMode;
  onClickCoordsRef.current = onMapClickCoordinates;

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

        // Show full Japan (Okinawa -> Hokkaido) on first paint
        map.fitBounds(JAPAN_INITIAL_BOUNDS, {
          padding: { top: 76, bottom: 105, left: 32, right: 32 },
          duration: 0,
        });

        // Climate radial glow source/layer
        map.addSource(CLIMATE_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: CLIMATE_LAYER_ID,
          type: 'circle',
          source: CLIMATE_SOURCE_ID,
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              4,
              32,
              8,
              90,
            ],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.34,
            'circle-blur': 0.85,
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
            'line-width': ['case', ['get', 'isToday'], 4.5, 2.8],
            'line-opacity': ['case', ['get', 'reached'], 0.92, 0.38],
            'line-dasharray': [2, 1.4],
          },
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
      duration: 950,
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

  // Sync Weather / Momiji Layer
  useEffect(() => {
    climateMarkersRef.current.forEach((m) => m.remove());
    climateMarkersRef.current = [];

    const map = mapRef.current;
    if (!map || !mapReady) return;

    const climateSource = map.getSource(CLIMATE_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;

    if (mode !== 'planning' || !activeLayer || !climateSnapshot) {
      climateSource?.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const glowFeatures: GeoJSON.Feature<GeoJSON.Point>[] =
      climateSnapshot.stations.map((st) => ({
        type: 'Feature',
        properties: {
          color: getLayerColor(activeLayer, st),
        },
        geometry: {
          type: 'Point',
          coordinates: [st.lng, st.lat],
        },
      }));

    climateSource?.setData({
      type: 'FeatureCollection',
      features: glowFeatures,
    });

    for (const st of climateSnapshot.stations) {
      const el = createClimatePillElement(activeLayer, st);
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([st.lng, st.lat])
        .addTo(map);
      climateMarkersRef.current.push(marker);
    }
  }, [mode, activeLayer, climateSnapshot, mapReady]);

  function handleResetJapanView() {
    mapRef.current?.fitBounds(JAPAN_INITIAL_BOUNDS, {
      padding: { top: 76, bottom: 105, left: 32, right: 32 },
      duration: 750,
    });
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Pick-on-map helper banner */}
      {pickMode && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-30 -translate-x-1/2 rounded-full bg-[#D95338] px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
          Cliquez n’importe où au Japon pour placer le point
        </div>
      )}

      {/* Zoom + Recenter Japan controls */}
      <div className="fixed bottom-28 right-3 z-20 flex flex-col gap-1.5 sm:right-4">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn({ duration: 220 })}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DFCBB7] bg-[#FDF9F2]/95 text-[#3B2B22] shadow-md backdrop-blur-md transition hover:bg-[#F5EADC]"
          title="Zoomer"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut({ duration: 220 })}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DFCBB7] bg-[#FDF9F2]/95 text-[#3B2B22] shadow-md backdrop-blur-md transition hover:bg-[#F5EADC]"
          title="Dézoomer"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleResetJapanView}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DFCBB7] bg-[#FDF9F2]/95 text-[#D95338] shadow-md backdrop-blur-md transition hover:bg-[#F5EADC]"
          title="Vue complète du Japon (Okinawa à Hokkaido)"
        >
          <LocateFixed className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
