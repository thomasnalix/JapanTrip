'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { MapPinPlus, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityDrawer } from '@/components/ActivityDrawer';
import {
  AppMode,
  JapanMap,
  MapFocusTarget,
} from '@/components/JapanMap';
import { PlanningPanel } from '@/components/PlanningPanel';
import { SearchPlaceBar } from '@/components/SearchPlaceBar';
import { SettingsModal } from '@/components/SettingsModal';
import { TimelineBar } from '@/components/TimelineBar';
import { TripStepModal } from '@/components/TripStepModal';
import { CATEGORY_ICONS, UI_ICONS } from '@/lib/icons';
import { getTripDays } from '@/lib/japan-bounds';
import {
  Activity,
  Author,
  AuthorSchema,
  CATEGORIES,
  Category,
  ClimateDaySnapshot,
  createDefaultTripData,
  SearchPlaceResult,
  TripData,
  TripMutation,
  TripSettings,
  TripStep,
  WeatherLayerType,
} from '@/lib/schemas';

const AUTHOR_STORAGE_KEY = 'japantrip:active-author';

export default function HomePage() {
  const [tripData, setTripData] = useState<TripData>(createDefaultTripData);
  const [matchedEnvKey, setMatchedEnvKey] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [activeAuthor, setActiveAuthor] = useState<Author | null>(null);
  const [authorChecked, setAuthorChecked] = useState(false);

  const [mode, setMode] = useState<AppMode>('activities');
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [pickOnMap, setPickOnMap] = useState(false);
  const [repositioningActivity, setRepositioningActivity] = useState(false);

  const [activeActivity, setActiveActivity] = useState<{
    activity: Activity;
    isNew: boolean;
  } | null>(null);

  const [activeStepModal, setActiveStepModal] = useState<{
    step: TripStep;
    isNew: boolean;
  } | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);

  const tripDays = useMemo(
    () =>
      getTripDays(tripData.settings.startDate, tripData.settings.endDate),
    [tripData.settings.startDate, tripData.settings.endDate]
  );
  const [timelineIdx, setTimelineIdx] = useState(0);
  const safeTimelineIdx = Math.min(timelineIdx, Math.max(0, tripDays.length - 1));
  const activeDate = tripDays[safeTimelineIdx] ?? tripData.settings.startDate;

  const [activeLayer, setActiveLayer] = useState<WeatherLayerType | null>(
    'temperature'
  );
  const [climateSeries, setClimateSeries] = useState<ClimateDaySnapshot[]>([]);
  const [climateLoading, setClimateLoading] = useState(false);
  const lastFetchAtRef = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem(AUTHOR_STORAGE_KEY);
    const parsed = AuthorSchema.safeParse(saved);
    if (parsed.success) {
      setActiveAuthor(parsed.data);
    }
    setAuthorChecked(true);
  }, []);

  const fetchTripData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchAtRef.current < 10_000) return;
    lastFetchAtRef.current = now;
    setSyncing(true);

    try {
      const res = await fetch('/api/trip', { cache: 'no-store' });
      const json = (await res.json()) as {
        data?: TripData;
        matchedEnvKey?: string;
        error?: string;
      };
      if (!res.ok || !json.data) {
        setSyncError(json.error ?? 'Redis non connecté');
        return;
      }
      setMatchedEnvKey(json.matchedEnvKey ?? null);
      setSyncError(null);
      setTripData(json.data);
    } catch {
      setSyncError('Erreur réseau');
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void fetchTripData(true);
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchTripData();
      }
    }, 20_000);
    const onFocus = () => void fetchTripData();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(poll);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchTripData]);

  // Climate data is cached server-side in Upstash Redis + browser localStorage
  useEffect(() => {
    const start = tripData.settings.startDate;
    const end = tripData.settings.endDate;
    const cacheKey = `japantrip:climate:v2:${start}:${end}`;

    const cachedRaw = localStorage.getItem(cacheKey);
    if (cachedRaw) {
      try {
        const parsed = JSON.parse(cachedRaw) as {
          savedAt: number;
          snapshots: ClimateDaySnapshot[];
        };
        if (Date.now() - parsed.savedAt < 6 * 60 * 60 * 1000) {
          setClimateSeries(parsed.snapshots);
          return;
        }
      } catch {
        // Ignore stale cache
      }
    }

    let cancelled = false;
    setClimateLoading(true);
    fetch(`/api/climate?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((json: { snapshots?: ClimateDaySnapshot[] }) => {
        if (cancelled || !json.snapshots) return;
        setClimateSeries(json.snapshots);
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ savedAt: Date.now(), snapshots: json.snapshots })
          );
        } catch {
          // Ignore quota errors
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setClimateLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tripData.settings.startDate, tripData.settings.endDate]);

  async function mutateTrip(mutation: TripMutation) {
    setSyncing(true);
    try {
      const res = await fetch('/api/trip', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mutation),
      });
      const json = (await res.json()) as {
        data?: TripData;
        matchedEnvKey?: string;
        error?: string;
      };
      if (!res.ok || !json.data) {
        setSyncError(json.error ?? 'Échec de sauvegarde Redis');
        return;
      }
      setMatchedEnvKey(json.matchedEnvKey ?? null);
      setSyncError(null);
      setTripData(json.data);
    } catch {
      setSyncError('Erreur réseau lors de la sauvegarde');
    } finally {
      setSyncing(false);
    }
  }

  function handleSelectAuthor(author: Author) {
    setActiveAuthor(author);
    localStorage.setItem(AUTHOR_STORAGE_KEY, author);
  }

  function handleSelectPlaceForActivity(place: SearchPlaceResult) {
    const author: Author = activeAuthor ?? 'Thomas';
    const now = new Date().toISOString();
    const draft: Activity = {
      id: crypto.randomUUID(),
      name: place.name,
      description: place.description || place.address,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      category: place.suggestedCategory,
      rating: 4,
      note: '',
      links: [],
      photos: [],
      createdBy: author,
      createdAt: now,
      updatedBy: author,
      updatedAt: now,
      history: [{ author, action: 'created', at: now, summary: 'Recherche carte' }],
    };
    setPickOnMap(false);
    setActiveActivity({ activity: draft, isNew: true });
    setFocusTarget({
      lat: place.lat,
      lng: place.lng,
      zoom: 13.5,
      nonce: Date.now(),
    });
  }

  const handleMoveActivity = useCallback(
    (id: string, lat: number, lng: number) => {
      const author: Author = activeAuthor ?? 'Thomas';
      const now = new Date().toISOString();
      const existing = tripData.activities.find((a) => a.id === id);

      if (existing) {
        const updated: Activity = {
          ...existing,
          lat,
          lng,
          updatedBy: author,
          updatedAt: now,
          history: [
            ...existing.history.slice(-14),
            {
              author,
              action: 'updated',
              at: now,
              summary: 'Déplacé sur la carte',
            },
          ],
        };
        setTripData((prev) => ({
          ...prev,
          activities: prev.activities.map((a) => (a.id === id ? updated : a)),
        }));
        setActiveActivity((prev) =>
          prev && prev.activity.id === id
            ? { activity: updated, isNew: false }
            : prev
        );
        void mutateTrip({ action: 'upsert_activity', activity: updated });
        return;
      }

      setActiveActivity((prev) =>
        prev && prev.activity.id === id
          ? {
              ...prev,
              activity: {
                ...prev.activity,
                lat,
                lng,
                updatedBy: author,
                updatedAt: now,
              },
            }
          : prev
      );
    },
    [activeAuthor, tripData.activities]
  );

  const handleMapClickCoordinates = useCallback(
    (lat: number, lng: number) => {
      const author: Author = activeAuthor ?? 'Thomas';
      const now = new Date().toISOString();
      setPickOnMap(false);

      if (mode === 'activities') {
        if (repositioningActivity && activeActivity) {
          setRepositioningActivity(false);
          handleMoveActivity(activeActivity.activity.id, lat, lng);
          return;
        }
        const draft: Activity = {
          id: crypto.randomUUID(),
          name: '',
          description: '',
          lat,
          lng,
          category: 'other',
          rating: 4,
          note: '',
          links: [],
          photos: [],
          createdBy: author,
          createdAt: now,
          updatedBy: author,
          updatedAt: now,
          history: [{ author, action: 'created', at: now, summary: 'Point manuel' }],
        };
        setActiveActivity({ activity: draft, isNew: true });
      } else {
        const draft: TripStep = {
          id: crypto.randomUUID(),
          title: '',
          type: 'milestone',
          date: activeDate,
          fromName: `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
          fromLat: lat,
          fromLng: lng,
          note: '',
          booked: false,
          createdBy: author,
          createdAt: now,
          updatedBy: author,
          updatedAt: now,
        };
        setActiveStepModal({ step: draft, isNew: true });
      }
    },
    [activeAuthor, mode, activeDate, repositioningActivity, activeActivity, handleMoveActivity]
  );

  function handleSaveActivity(updated: Activity, closeAfter = false) {
    setTripData((prev) => {
      const exists = prev.activities.some((a) => a.id === updated.id);
      const activities = exists
        ? prev.activities.map((a) => (a.id === updated.id ? updated : a))
        : [updated, ...prev.activities];
      return { ...prev, activities };
    });
    if (closeAfter) {
      setActiveActivity(null);
    } else {
      setActiveActivity({ activity: updated, isNew: false });
    }
    void mutateTrip({ action: 'upsert_activity', activity: updated });
  }

  function handleDeleteActivity(id: string) {
    setTripData((prev) => ({
      ...prev,
      activities: prev.activities.filter((a) => a.id !== id),
    }));
    setActiveActivity(null);
    void mutateTrip({ action: 'delete_activity', id });
  }

  function handleSaveStep(step: TripStep) {
    setTripData((prev) => {
      const exists = prev.tripSteps.some((s) => s.id === step.id);
      const tripSteps = (
        exists
          ? prev.tripSteps.map((s) => (s.id === step.id ? step : s))
          : [...prev.tripSteps, step]
      ).sort((a, b) => a.date.localeCompare(b.date));
      return { ...prev, tripSteps };
    });
    setActiveStepModal(null);
    setFocusTarget({
      lat: step.fromLat,
      lng: step.fromLng,
      zoom: 7.5,
      nonce: Date.now(),
    });
    void mutateTrip({ action: 'upsert_step', step });
  }

  function handleDeleteStep(id: string) {
    setTripData((prev) => ({
      ...prev,
      tripSteps: prev.tripSteps.filter((s) => s.id !== id),
    }));
    setActiveStepModal(null);
    void mutateTrip({ action: 'delete_step', id });
  }

  function handleSaveSettings(settings: TripSettings) {
    setTripData((prev) => ({ ...prev, settings }));
    void mutateTrip({ action: 'update_settings', settings });
  }

  function handleImportTripData(data: TripData) {
    setTripData(data);
    void mutateTrip({ action: 'replace_all', data });
  }

  function toggleCategoryFilter(cat: Category) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  const filteredActivities = useMemo(() => {
    if (selectedCategories.length === 0) return tripData.activities;
    return tripData.activities.filter((a) =>
      selectedCategories.includes(a.category)
    );
  }, [tripData.activities, selectedCategories]);

  const currentClimateSnapshot = useMemo(
    () => climateSeries[safeTimelineIdx] ?? null,
    [climateSeries, safeTimelineIdx]
  );

  const mustPickAuthor = authorChecked && !activeAuthor;
  const displayTitle =
    tripData.settings.tripTitle === 'Japon — Nell & Thomas'
      ? 'Japon'
      : tripData.settings.tripTitle;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-zinc-50">
      {/* Fullscreen Map */}
      <JapanMap
        mode={mode}
        activities={filteredActivities}
        selectedActivityId={activeActivity?.activity.id ?? null}
        steps={tripData.tripSteps}
        activeDate={activeDate}
        activeLayer={activeLayer}
        climateSnapshot={currentClimateSnapshot}
        pickMode={pickOnMap}
        pickBannerText={
          repositioningActivity
            ? 'Cliquez sur la carte pour déplacer ce point'
            : undefined
        }
        focusTarget={focusTarget}
        onMapClickCoordinates={handleMapClickCoordinates}
        onSelectActivity={(act) => {
          setRepositioningActivity(false);
          setPickOnMap(false);
          setActiveActivity({ activity: act, isNew: false });
        }}
        onMoveActivity={handleMoveActivity}
        onSelectStep={(step) => {
          setActiveStepModal({ step, isNew: false });
          setFocusTarget({
            lat: step.fromLat,
            lng: step.fromLng,
            zoom: 7.5,
            nonce: Date.now(),
          });
        }}
      />

      {/* Top Navigation Bar */}
      <header className="pointer-events-none fixed left-3 right-3 top-3 z-30 flex flex-wrap items-center justify-between gap-2 sm:left-4 sm:right-4">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur-md">
          <span className="text-sm font-semibold tracking-tight text-zinc-900">
            {displayTitle}
          </span>

          <div className="ml-1 flex rounded-lg bg-zinc-100 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setMode('activities');
                setPickOnMap(false);
              }}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition ${
                mode === 'activities'
                  ? 'bg-[#C83228] text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <FontAwesomeIcon icon={UI_ICONS.map} className="text-[11px]" />
              <span>Activités</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('planning');
                setPickOnMap(false);
                setActiveActivity(null);
              }}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition ${
                mode === 'planning'
                  ? 'bg-[#C83228] text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <FontAwesomeIcon icon={UI_ICONS.compass} className="text-[11px]" />
              <span>Étapes & Météo</span>
            </button>
          </div>
        </div>

        {/* Sync status + Refresh + Author badge + Settings */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void fetchTripData(true)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-md transition ${
              syncError
                ? 'border-red-200 bg-red-50/95 text-[#C83228]'
                : 'border-zinc-200 bg-white/95 text-zinc-700 hover:bg-zinc-50'
            }`}
            title={
              syncError
                ? syncError
                : matchedEnvKey
                  ? `Synchronisé via Redis (${matchedEnvKey})`
                  : 'Synchroniser'
            }
          >
            <span
              className={`h-2 w-2 rounded-full ${
                syncError ? 'bg-[#C83228]' : 'bg-emerald-500'
              }`}
            />
            <span className="hidden sm:inline">
              {syncError ? 'Redis hors ligne' : 'Sync'}
            </span>
            <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
          </button>

          {activeAuthor && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-zinc-800 shadow-sm backdrop-blur-md transition hover:bg-zinc-50"
            >
              <FontAwesomeIcon
                icon={UI_ICONS.user}
                className="text-[11px] text-[#C83228]"
              />
              <span>{activeAuthor}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white/95 text-zinc-600 shadow-sm backdrop-blur-md transition hover:bg-zinc-50 hover:text-zinc-900"
            title="Paramètres"
          >
            <FontAwesomeIcon icon={UI_ICONS.settings} className="text-xs" />
          </button>
        </div>
      </header>

      {/* Activities Mode Overlay */}
      {mode === 'activities' && (
        <div className="pointer-events-none fixed left-3 right-3 top-[60px] z-20 flex flex-col gap-2 sm:left-4 sm:right-4">
          <div className="pointer-events-auto flex w-full max-w-md items-center gap-2">
            <div className="flex-1">
              <SearchPlaceBar onSelectPlace={handleSelectPlaceForActivity} />
            </div>
            <button
              type="button"
              onClick={() => setPickOnMap((p) => !p)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium shadow-sm backdrop-blur-md transition ${
                pickOnMap
                  ? 'border-[#C83228] bg-[#C83228] text-white'
                  : 'border-zinc-200 bg-white/95 text-zinc-800 hover:bg-zinc-50'
              }`}
              title="Ajouter manuellement en cliquant sur la carte"
            >
              <MapPinPlus className="h-4 w-4" />
              <span className="hidden sm:inline">
                {pickOnMap ? 'Annuler' : 'Pointer'}
              </span>
            </button>
          </div>

          {/* Full-width wrapping Category Filter Bar */}
          <div className="pointer-events-auto flex w-full flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategories([])}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium shadow-xs transition ${
                selectedCategories.length === 0
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white/95 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>Tout ({tripData.activities.length})</span>
            </button>

            {CATEGORIES.map((cat) => {
              const active = selectedCategories.includes(cat.id);
              const count = tripData.activities.filter(
                (a) => a.category === cat.id
              ).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategoryFilter(cat.id)}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium shadow-xs transition ${
                    active
                      ? 'border-transparent text-white shadow-xs'
                      : 'border-zinc-200 bg-white/95 text-zinc-700 hover:bg-zinc-50'
                  }`}
                  style={active ? { backgroundColor: cat.color } : undefined}
                >
                  <FontAwesomeIcon
                    icon={CATEGORY_ICONS[cat.id]}
                    className="text-[11px]"
                    style={!active ? { color: cat.color } : undefined}
                  />
                  <span>{cat.label}</span>
                  {count > 0 && <span className="opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Planning & Climate Mode Panel */}
      {mode === 'planning' && (
        <PlanningPanel
          steps={tripData.tripSteps}
          activeDate={activeDate}
          activeLayer={activeLayer}
          climateSnapshot={currentClimateSnapshot}
          climateLoading={climateLoading}
          pickStepOnMap={pickOnMap}
          onTogglePickStepOnMap={() => setPickOnMap((p) => !p)}
          onSelectLayer={setActiveLayer}
          onOpenNewStep={() => {
            const author: Author = activeAuthor ?? 'Thomas';
            const now = new Date().toISOString();
            setActiveStepModal({
              isNew: true,
              step: {
                id: crypto.randomUUID(),
                title: '',
                type: 'train',
                date: activeDate,
                fromName: '',
                fromLat: 35.68,
                fromLng: 139.77,
                note: '',
                booked: false,
                createdBy: author,
                createdAt: now,
                updatedBy: author,
                updatedAt: now,
              },
            });
          }}
          onSelectStep={(step) => {
            setActiveStepModal({ step, isNew: false });
            setFocusTarget({
              lat: step.fromLat,
              lng: step.fromLng,
              zoom: 7.5,
              nonce: Date.now(),
            });
          }}
        />
      )}

      {/* Activity Details / Editor Drawer */}
      {mode === 'activities' && activeActivity && (
        <ActivityDrawer
          activity={activeActivity.activity}
          isNew={activeActivity.isNew}
          activeAuthor={activeAuthor ?? 'Thomas'}
          isRepositioning={repositioningActivity && pickOnMap}
          onToggleReposition={() => {
            const next = !(repositioningActivity && pickOnMap);
            setRepositioningActivity(next);
            setPickOnMap(next);
          }}
          onFocusLocation={(lat, lng) =>
            setFocusTarget({ lat, lng, zoom: 13.5, nonce: Date.now() })
          }
          onSave={handleSaveActivity}
          onDelete={handleDeleteActivity}
          onClose={() => {
            setRepositioningActivity(false);
            setPickOnMap(false);
            setActiveActivity(null);
          }}
        />
      )}

      {/* Trip Step Modal */}
      {activeStepModal && (
        <TripStepModal
          step={activeStepModal.step}
          isNew={activeStepModal.isNew}
          activeAuthor={activeAuthor ?? 'Thomas'}
          onSave={handleSaveStep}
          onDelete={handleDeleteStep}
          onClose={() => setActiveStepModal(null)}
        />
      )}

      {/* Bottom Timeline Slider */}
      <div className="pointer-events-none fixed bottom-3 left-3 right-3 z-20">
        <TimelineBar
          days={tripDays}
          activeIndex={safeTimelineIdx}
          onChangeIndex={setTimelineIdx}
          steps={tripData.tripSteps}
        />
      </div>

      {/* Settings & First-time Author Modal */}
      <SettingsModal
        open={settingsOpen || mustPickAuthor}
        mustPickAuthor={mustPickAuthor}
        activeAuthor={activeAuthor}
        settings={tripData.settings}
        tripData={tripData}
        matchedEnvKey={matchedEnvKey}
        syncError={syncError}
        onSelectAuthor={handleSelectAuthor}
        onSaveSettings={handleSaveSettings}
        onImportTripData={handleImportTripData}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
