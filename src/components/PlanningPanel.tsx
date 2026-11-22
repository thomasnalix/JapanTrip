'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ChevronDown, ChevronUp, Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { LAYER_ICONS, STEP_ICONS } from '@/lib/icons';
import { formatFrenchDate } from '@/lib/japan-bounds';
import { WEATHER_LAYERS } from '@/lib/japan-climate';
import {
  ClimateDaySnapshot,
  STEP_TYPE_META,
  TripStep,
  WeatherLayerType,
} from '@/lib/schemas';

interface PlanningPanelProps {
  steps: TripStep[];
  activeDate: string;
  activeLayer: WeatherLayerType | null;
  climateSnapshot: ClimateDaySnapshot | null;
  climateLoading: boolean;
  pickStepOnMap: boolean;
  onTogglePickStepOnMap: () => void;
  onSelectLayer: (layer: WeatherLayerType | null) => void;
  onOpenNewStep: () => void;
  onSelectStep: (step: TripStep) => void;
}

export function PlanningPanel({
  steps,
  activeDate,
  activeLayer,
  climateSnapshot,
  climateLoading,
  pickStepOnMap,
  onTogglePickStepOnMap,
  onSelectLayer,
  onOpenNewStep,
  onSelectStep,
}: PlanningPanelProps) {
  const [stepsExpandedMobile, setStepsExpandedMobile] = useState(false);
  const activeLayerMeta = activeLayer ? WEATHER_LAYERS[activeLayer] : null;

  return (
    <div className="pointer-events-none fixed left-2.5 right-2.5 top-[54px] z-20 flex flex-col gap-2 sm:left-4 sm:right-auto sm:top-[64px] sm:w-[330px] sm:gap-2.5">
      {/* 4 Climate / Momiji Zoning Layers Card */}
      <div className="pointer-events-auto rounded-xl border border-zinc-200 bg-white/95 p-2.5 shadow-md backdrop-blur-md sm:p-3">
        <div className="mb-1.5 flex items-center justify-between sm:mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[11px]">
            Zonage météo & saisons
          </span>
          {climateLoading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C83228]" />
          )}
        </div>

        <div className="grid grid-cols-4 gap-1 sm:grid-cols-2 sm:gap-1.5">
          {(Object.keys(WEATHER_LAYERS) as WeatherLayerType[]).map((key) => {
            const meta = WEATHER_LAYERS[key];
            const active = activeLayer === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectLayer(active ? null : key)}
                className={`flex items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-[11px] font-medium transition sm:justify-start sm:gap-2 sm:px-2.5 sm:text-xs ${
                  active
                    ? 'border-[#C83228] bg-[#C83228] text-white shadow-xs'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <FontAwesomeIcon
                  icon={LAYER_ICONS[key]}
                  className="text-[11px]"
                />
                <span className="truncate">{meta.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {activeLayerMeta && (
          <div className="mt-2 space-y-1 border-t border-zinc-200 pt-1.5 sm:mt-2.5 sm:space-y-1.5 sm:pt-2">
            <p className="hidden text-[11px] text-zinc-600 sm:block">
              {activeLayerMeta.description}
            </p>
            <div className="flex items-center justify-between gap-1">
              {activeLayerMeta.stops.map((stop) => (
                <div
                  key={stop.label}
                  className="flex flex-1 flex-col items-center gap-0.5"
                >
                  <span
                    className="h-1.5 w-full rounded-full sm:h-2"
                    style={{ backgroundColor: stop.color }}
                  />
                  <span className="text-[9px] font-medium text-zinc-600 sm:text-[10px]">
                    {stop.label}
                  </span>
                </div>
              ))}
            </div>
            {climateSnapshot && (
              <div className="hidden text-[10px] text-zinc-400 sm:block">
                {activeLayer === 'momiji'
                  ? '221 sous-zones — Calendrier JMA + températures 10 ans'
                  : climateSnapshot.source === 'forecast'
                    ? '221 sous-zones — Prévisions Open-Meteo'
                    : climateSnapshot.source === 'archive-10y'
                      ? `221 sous-zones — Moyenne 10 ans Open-Meteo (${climateSnapshot.referenceYear - 9}–${climateSnapshot.referenceYear})`
                      : climateSnapshot.source === 'archive'
                        ? `221 sous-zones — Historique Open-Meteo (${climateSnapshot.referenceYear})`
                        : '221 sous-zones — Données météo indisponibles'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Major Trip Steps Card (collapsible on mobile so map stays unobstructed) */}
      <div className="pointer-events-auto flex max-h-[38dvh] flex-col rounded-xl border border-zinc-200 bg-white/95 shadow-md backdrop-blur-md sm:max-h-[42vh]">
        <div className="flex items-center justify-between px-3 py-2 sm:border-b sm:border-zinc-200 sm:py-2.5">
          <button
            type="button"
            onClick={() => setStepsExpandedMobile((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 sm:cursor-default"
          >
            <span>Grandes étapes ({steps.length})</span>
            <span className="text-zinc-400 sm:hidden">
              {stepsExpandedMobile ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </span>
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onTogglePickStepOnMap}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                pickStepOnMap
                  ? 'bg-[#C83228] text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
              title="Cliquer sur la carte pour placer une étape"
            >
              {pickStepOnMap ? 'Clic actif...' : 'Pointer'}
            </button>
            <button
              type="button"
              onClick={onOpenNewStep}
              className="flex items-center gap-1 rounded-md bg-[#C83228] px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-[#B02A21]"
            >
              <Plus className="h-3.5 w-3.5" />
              Étape
            </button>
          </div>
        </div>

        <div
          className={`thin-scroll flex-1 space-y-1.5 overflow-y-auto border-t border-zinc-200 p-2.5 sm:border-t-0 ${
            stepsExpandedMobile ? 'block' : 'hidden sm:block'
          }`}
        >
          {steps.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-zinc-500">
              Ajoutez vos vols internes, trains, hôtels et étapes clés pour
              tracer l’itinéraire.
            </p>
          ) : (
            steps.map((step) => {
              const meta = STEP_TYPE_META[step.type];
              const isToday =
                step.date === activeDate ||
                (step.endDate &&
                  activeDate >= step.date &&
                  activeDate <= step.endDate);
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onSelectStep(step)}
                  className={`flex w-full items-start gap-2.5 rounded-lg border p-2 text-left transition ${
                    isToday
                      ? 'border-[#C83228] bg-red-50/50'
                      : 'border-zinc-200 bg-white hover:bg-zinc-50'
                  }`}
                >
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs text-white"
                    style={{ backgroundColor: meta.color }}
                  >
                    <FontAwesomeIcon icon={STEP_ICONS[step.type]} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-semibold text-zinc-900">
                        {step.title}
                      </span>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                          step.booked
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        {step.booked ? 'Réservé' : 'À réserver'}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-zinc-600">
                      {step.fromName}
                      {step.toName ? ` → ${step.toName}` : ''}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-400">
                      <span>{formatFrenchDate(step.date)}</span>
                      {step.bookingRef && <span>• {step.bookingRef}</span>}
                      {step.price && <span>• {step.price}</span>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
