'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  Calendar,
  Cloud,
  Download,
  HardDrive,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { UI_ICONS } from '@/lib/icons';
import {
  Author,
  TripData,
  TripDataSchema,
  TripSettings,
} from '@/lib/schemas';
import type { StorageMode } from '@/lib/storage';

interface SettingsModalProps {
  open: boolean;
  mustPickAuthor: boolean;
  activeAuthor: Author | null;
  settings: TripSettings;
  tripData: TripData;
  storageMode: StorageMode;
  onSelectAuthor: (author: Author) => void;
  onSaveSettings: (settings: TripSettings) => void;
  onImportTripData: (data: TripData) => void;
  onClose: () => void;
}

export function SettingsModal({
  open,
  mustPickAuthor,
  activeAuthor,
  settings,
  tripData,
  storageMode,
  onSelectAuthor,
  onSaveSettings,
  onImportTripData,
  onClose,
}: SettingsModalProps) {
  const [tripTitle, setTripTitle] = useState(settings.tripTitle);
  const [startDate, setStartDate] = useState(settings.startDate);
  const [endDate, setEndDate] = useState(settings.endDate);
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTripTitle(settings.tripTitle);
      setStartDate(settings.startDate);
      setEndDate(settings.endDate);
      setImportError('');
    }
  }, [open, settings]);

  if (!open) return null;

  function handleSave() {
    if (endDate < startDate) {
      return;
    }
    onSaveSettings({
      tripTitle: tripTitle.trim() || 'Japon',
      startDate,
      endDate,
    });
    if (activeAuthor) {
      onClose();
    }
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(tripData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `japon-trip-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    setImportError('');
    try {
      const text = await file.text();
      const parsed = TripDataSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        setImportError('Fichier JSON invalide.');
        return;
      }
      onImportTripData(parsed.data);
      onClose();
    } catch {
      setImportError('Impossible de lire ce fichier JSON.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            {mustPickAuthor ? 'Bienvenue sur Japon' : 'Paramètres'}
          </h2>
          {!mustPickAuthor && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-5 p-5">
          {/* Who are you? */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <UserCheck className="h-3.5 w-3.5" />
              Qui utilise cet appareil ? (mémorisé localement)
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {(['Nell', 'Thomas'] as const).map((person) => {
                const selected = activeAuthor === person;
                return (
                  <button
                    key={person}
                    type="button"
                    onClick={() => onSelectAuthor(person)}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                      selected
                        ? 'border-[#C83228] bg-[#C83228] text-white shadow-xs'
                        : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                    }`}
                  >
                    <FontAwesomeIcon icon={UI_ICONS.user} className="text-xs" />
                    <span>{person}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trip Dates & Title */}
          <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
              <Calendar className="h-3.5 w-3.5" />
              Dates et titre
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-500">
                Titre
              </label>
              <input
                type="text"
                value={tripTitle}
                onChange={(e) => setTripTitle(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#C83228]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-zinc-500">
                  Début
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#C83228]"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-zinc-500">
                  Fin
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#C83228]"
                />
              </div>
            </div>
          </div>

          {/* Storage & Backup */}
          <div className="space-y-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-zinc-800">
                {storageMode === 'upstash' ? (
                  <Cloud className="h-4 w-4 text-emerald-600" />
                ) : (
                  <HardDrive className="h-4 w-4 text-amber-600" />
                )}
                {storageMode === 'upstash'
                  ? 'Upstash Redis connecté'
                  : storageMode === 'local-file'
                    ? 'Stockage local (data/trip-data.json)'
                    : 'Mode navigateur (ajouter Upstash sur Vercel)'}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white py-1.5 font-medium text-zinc-800 hover:bg-zinc-100"
              >
                <Download className="h-3.5 w-3.5" />
                Exporter JSON
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white py-1.5 font-medium text-zinc-800 hover:bg-zinc-100"
              >
                <Upload className="h-3.5 w-3.5" />
                Importer JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => void handleImport(e.target.files?.[0])}
              />
            </div>
            {importError && (
              <p className="text-[11px] text-[#C83228]">{importError}</p>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-200 bg-zinc-50 px-5 py-3">
          <button
            type="button"
            disabled={!activeAuthor || endDate < startDate}
            onClick={handleSave}
            className="w-full rounded-lg bg-[#C83228] py-2 text-sm font-medium text-white transition hover:bg-[#B02A21] disabled:opacity-45"
          >
            {mustPickAuthor ? 'Commencer' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
