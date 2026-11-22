'use client';

import {
  Compass,
  Map as MapIcon,
  MapPinPlus,
  Settings,
  SlidersHorizontal,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  TripDataSchema,
  TripMutation,
  TripSettings,
  TripStep,
  WeatherLayerType,
} from '@/lib/schemas';
import type { StorageMode } from '@/lib/storage';

const AUTHOR_STORAGE_KEY = 'japantrip:active-author';
const LOCAL_TRIP_BACKUP_KEY = 'japantrip:trip-data-backup';

export default function HomePage() {
  const [tripData, setTripData] = useState<TripData>(createDefaultTripData);
  const [storageMode, setStorageMode] = useState<StorageMode>('local-file');
  const [activeAuthor, setActiveAuthor] = useState<Author | null>(null);
  const [authorChecked, setAuthorChecked] = useState(false);

  const [mode, setMode] = useState<AppMode>('activities');
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [pickOnMap, setPickOnMap] = useState(false);

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

  // Timeline & Climate layers
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

  // Load persisted Nell/Thomas identity forever from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(AUTHOR_STORAGE_KEY);
    const parsed = AuthorSchema.safeParse(saved);
    if (parsed.success) {
      setActiveAuthor(parsed.data);
    }
    setAuthorChecked(true);
  }, []);

  const fetchTripData = useCallback(async () => {
    try {
      const res = await fetch('/api/trip', { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as {
        data: TripData;
        storageMode: StorageMode;
      };
      setStorageMode(json.storageMode);
      if (json.storageMode === 'ephemeral') {
        const localRaw = localStorage.getItem(LOCAL_TRIP_BACKUP_KEY);
        if (localRaw) {
          const parsed = TripDataSchema.safeParse(JSON.parse(localRaw));
          if (parsed.success) {
            setTripData(parsed.data);
            return;
          }
        }
      }
      setTripData(json.data);
      localStorage.setItem(LOCAL_TRIP_BACKUP_KEY, JSON.stringify(json.data));
    } catch {
      const localRaw = localStorage.getItem(LOCAL_TRIP_BACKUP_KEY);
      if (localRaw) {
        const parsed = TripDataSchema.safeParse(JSON.parse(localRaw));
        if (parsed.success) setTripData(parsed.data);
      }
    }
  }, []);

  useEffect(() => {
    void fetchTripData();
    const poll = setInterval(() => {
      void fetchTripData();
    }, 25_000);
    return () => clearInterval(poll);
  }, [fetchTripData]);

  // Fetch & cache climate/momiji series whenever trip dates change
  useEffect(() => {
    const start = tripData.settings.startDate;
    const end = tripData.settings.endDate;
    const cacheKey = `japantrip:climate:${start}:${end}`;

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
    try {
      const res = await fetch('/api/trip', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mutation),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          data: TripData;
          storageMode: StorageMode;
        };
        setStorageMode(json.storageMode);
        setTripData(json.data);
        localStorage.setItem(LOCAL_TRIP_BACKUP_KEY, JSON.stringify(json.data));
      }
    } catch {
      // Keep optimistic local backup
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
    setFocusTarget({ lat: place.lat, lng: place.lng, zoom: 13.5, nonce: Date.now() });
  }

  const handleMapClickCoordinates = useCallback(
    (lat: number, lng: number) => {
      const author: Author = activeAuthor ?? 'Thomas';
      const now = new Date().toISOString();
      setPickOnMap(false);

      if (mode === 'activities') {
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
    [activeAuthor, mode, activeDate]
  );

  function handleSaveActivity(updated: Activity, closeAfter = false) {
    setTripData((prev) => {
      const exists = prev.activities.some((a) => a.id === updated.id);
      const activities = exists
        ? prev.activities.map((a) => (a.id === updated.id ? updated : a))
        : [updated, ...prev.activities];
      const next = { ...prev, activities };
      localStorage.setItem(LOCAL_TRIP_BACKUP_KEY, JSON.stringify(next));
      return next;
    });
    if (closeAfter) {
      setActiveActivity(null);
    } else {
      setActiveActivity({ activity: updated, isNew: false });
    }
    void mutateTrip({ action: 'upsert_activity', activity: updated });
  }

  function handleDeleteActivity(id: string) {
    setTripData((prev) => {
      const next = {
        ...prev,
        activities: prev.activities.filter((a) => a.id !== id),
      };
      localStorage.setItem(LOCAL_TRIP_BACKUP_KEY, JSON.stringify(next));
      return next;
    });
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
      const next = { ...prev, tripSteps };
      localStorage.setItem(LOCAL_TRIP_BACKUP_KEY, JSON.stringify(next));
      return next;
    });
    setActiveStepModal(null);
    setFocusTarget({ lat: step.fromLat, lng: step.fromLng, zoom: 7.5, nonce: Date.now() });
    void mutateTrip({ action: 'upsert_step', step });
  }

  function handleDeleteStep(id: string) {
    setTripData((prev) => {
      const next = {
        ...prev,
        tripSteps: prev.tripSteps.filter((s) => s.id !== id),
      };
      localStorage.setItem(LOCAL_TRIP_BACKUP_KEY, JSON.stringify(next));
      return next;
    });
    setActiveStepModal(null);
    void mutateTrip({ action: 'delete_step', id });
  }

  function handleSaveSettings(settings: TripSettings) {
    setTripData((prev) => {
      const next = { ...prev, settings };
      localStorage.setItem(LOCAL_TRIP_BACKUP_KEY, JSON.stringify(next));
      return next;
    });
    void mutateTrip({ action: 'update_settings', settings });
  }

  function handleImportTripData(data: TripData) {
    setTripData(data);
    localStorage.setItem(LOCAL_TRIP_BACKUP_KEY, JSON.stringify(data));
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

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#FAF2E6]">
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
        focusTarget={focusTarget}
        onMapClickCoordinates={handleMapClickCoordinates}
        onSelectActivity={(act) =>
          setActiveActivity({ activity: act, isNew: false })
        }
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
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-[#DFCBB7] bg-[#FDF9F2]/94 px-3 py-1.5 shadow-md backdrop-blur-md">
          <span className="text-base">🇯🇵</span>
          <span className="hidden text-sm font-bold text-[#3B2B22] sm:inline">
            {tripData.settings.tripTitle}
          </span>

          <div className="ml-1 flex rounded-xl bg-[#EFE3D2] p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('activities');
                setPickOnMap(false);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition ${
                mode === 'activities'
                  ? 'bg-white text-[#D95338] shadow-sm'
                  : 'text-[#6D5647] hover:text-[#3B2B22]'
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>Activités</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('planning');
                setPickOnMap(false);
                setActiveActivity(null);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition ${
                mode === 'planning'
                  ? 'bg-white text-[#2D6A7E] shadow-sm'
                  : 'text-[#6D5647] hover:text-[#3B2B22]'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Étapes & Météo</span>
            </button>
          </div>
        </div>

        {/* Author badge + Settings */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {activeAuthor && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-2xl border border-[#DFCBB7] bg-[#FDF9F2]/94 px-3 py-1.5 text-xs font-bold text-[#3B2B22] shadow-md backdrop-blur-md transition hover:bg-[#F5EADC]"
            >
              <span>{activeAuthor === 'Nell' ? '🌸' : '🗻'}</span>
              <span>{activeAuthor}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[#DFCBB7] bg-[#FDF9F2]/94 text-[#5D493C] shadow-md backdrop-blur-md transition hover:bg-[#F5EADC]"
            title="Paramètres"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Activities Mode Overlay: Search + Manual Point + Category Filter Pills */}
      {mode === 'activities' && (
        <div className="pointer-events-none fixed left-3 right-3 top-[68px] z-20 flex flex-col gap-2 sm:left-4 sm:right-auto sm:w-[440px]">
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="flex-1">
              <SearchPlaceBar onSelectPlace={handleSelectPlaceForActivity} />
            </div>
            <button
              type="button"
              onClick={() => setPickOnMap((p) => !p)}
              className={`flex shrink-0 items-center gap-1.5 rounded-2xl border px-3 py-2.5 text-xs font-semibold shadow-sm backdrop-blur-md transition ${
                pickOnMap
                  ? 'border-[#D95338] bg-[#D95338] text-white'
                  : 'border-[#DFCBB7] bg-[#FDF9F2]/95 text-[#3B2B22] hover:bg-[#F5EADC]'
              }`}
              title="Ajouter manuellement en cliquant sur la carte"
            >
              <MapPinPlus className="h-4 w-4" />
              <span className="hidden sm:inline">
                {pickOnMap ? 'Annuler' : 'Pointer'}
              </span>
            </button>
          </div>

          {/* Multi-select Category Filter Bar */}
          <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategories([])}
              className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-xs transition ${
                selectedCategories.length === 0
                  ? 'border-[#3B2B22] bg-[#3B2B22] text-white'
                  : 'border-[#DFCBB7] bg-[#FDF9F2]/92 text-[#5D493C] hover:bg-[#F5EADC]'
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
                  className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-xs transition ${
                    active
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-[#DFCBB7] bg-[#FDF9F2]/92 text-[#4A382D] hover:bg-[#F5EADC]'
                  }`}
                  style={active ? { backgroundColor: cat.color } : undefined}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                  {count > 0 && (
                    <span className="opacity-75">({count})</span>
                  )}
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
                fromName: 'Tokyo',
                fromLat: 35.6812,
                fromLng: 139.7671,
                toName: 'Kyoto',
                toLat: 34.9858,
                toLng: 135.7588,
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
          onSave={handleSaveActivity}
          onDelete={handleDeleteActivity}
          onClose={() => setActiveActivity(null)}
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
        storageMode={storageMode}
        onSelectAuthor={handleSelectAuthor}
        onSaveSettings={handleSaveSettings}
        onImportTripData={handleImportTripData}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
