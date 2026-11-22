'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { CheckCircle2, MapPin, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { STEP_ICONS } from '@/lib/icons';
import {
  Author,
  SearchPlaceResult,
  STEP_TYPES,
  STEP_TYPE_META,
  TripStep,
  TripStepType,
} from '@/lib/schemas';
import { SearchPlaceBar } from './SearchPlaceBar';

interface TripStepModalProps {
  step: TripStep;
  isNew: boolean;
  activeAuthor: Author;
  onSave: (step: TripStep) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function TripStepModal({
  step,
  isNew,
  activeAuthor,
  onSave,
  onDelete,
  onClose,
}: TripStepModalProps) {
  const [draft, setDraft] = useState<TripStep>(step);

  useEffect(() => {
    setDraft(step);
  }, [step]);

  const typeMeta = STEP_TYPE_META[draft.type];

  function handleSelectFrom(place: SearchPlaceResult) {
    setDraft((prev) => ({
      ...prev,
      fromName: place.name,
      fromLat: place.lat,
      fromLng: place.lng,
      title: prev.title || place.name,
    }));
  }

  function handleSelectTo(place: SearchPlaceResult) {
    setDraft((prev) => ({
      ...prev,
      toName: place.name,
      toLat: place.lat,
      toLng: place.lng,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim() || !draft.fromName.trim()) return;
    const now = new Date().toISOString();
    onSave({
      ...draft,
      title: draft.title.trim(),
      fromName: draft.fromName.trim(),
      toName: typeMeta.hasRoute ? draft.toName?.trim() : undefined,
      toLat: typeMeta.hasRoute ? draft.toLat : undefined,
      toLng: typeMeta.hasRoute ? draft.toLng : undefined,
      updatedBy: activeAuthor,
      updatedAt: now,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-zinc-200 bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <FontAwesomeIcon
              icon={STEP_ICONS[draft.type]}
              style={{ color: typeMeta.color }}
            />
            <span>{isNew ? 'Nouvelle étape' : 'Modifier l’étape'}</span>
          </h2>
          <div className="flex items-center gap-1">
            {!isNew && (
              <button
                type="button"
                onClick={() => onDelete(draft.id)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-[#C83228]"
                title="Supprimer cette étape"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="thin-scroll flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex flex-wrap gap-1.5">
            {STEP_TYPES.map((st) => {
              const selected = draft.type === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() =>
                    setDraft((p) => ({ ...p, type: st.id as TripStepType }))
                  }
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    selected
                      ? 'border-transparent text-white shadow-xs'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                  style={selected ? { backgroundColor: st.color } : undefined}
                >
                  <FontAwesomeIcon
                    icon={STEP_ICONS[st.id]}
                    className="text-[11px]"
                  />
                  <span>{st.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-medium text-zinc-500">
                Titre de l’étape *
              </label>
              <input
                type="text"
                required
                value={draft.title}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, title: e.target.value }))
                }
                placeholder="ex: Shinkansen Tokyo → Kyoto, Vol ANA Sapporo..."
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#C83228]"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-500">
                Date *
              </label>
              <input
                type="date"
                required
                value={draft.date}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, date: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-[#C83228]"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-500">
                Date de fin (opt.)
              </label>
              <input
                type="date"
                value={draft.endDate ?? ''}
                min={draft.date}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    endDate: e.target.value || undefined,
                  }))
                }
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-[#C83228]"
              />
            </div>
          </div>

          {/* Origin */}
          <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3">
            <label className="flex items-center gap-1 text-[11px] font-medium text-zinc-600">
              <MapPin className="h-3.5 w-3.5 text-[#C83228]" />
              {typeMeta.hasRoute ? 'Lieu de départ *' : 'Lieu / Ville *'}
            </label>
            <SearchPlaceBar
              compact
              placeholder="Rechercher une gare, aéroport, ville..."
              onSelectPlace={handleSelectFrom}
            />
            <div className="flex items-center gap-2 text-xs text-zinc-900">
              <input
                type="text"
                required
                value={draft.fromName}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, fromName: e.target.value }))
                }
                placeholder="Nom du lieu"
                className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#C83228]"
              />
              <span className="shrink-0 text-[10px] text-zinc-400">
                {draft.fromLat.toFixed(2)}, {draft.fromLng.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Destination */}
          {typeMeta.hasRoute && (
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-[11px] font-medium text-zinc-600">
                  <MapPin className="h-3.5 w-3.5 text-zinc-700" />
                  Lieu d’arrivée
                </label>
                {draft.toName && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((p) => ({
                        ...p,
                        toName: undefined,
                        toLat: undefined,
                        toLng: undefined,
                      }))
                    }
                    className="text-[11px] text-zinc-400 hover:text-[#C83228]"
                  >
                    Effacer
                  </button>
                )}
              </div>
              <SearchPlaceBar
                compact
                placeholder="Rechercher la destination..."
                onSelectPlace={handleSelectTo}
              />
              <div className="flex items-center gap-2 text-xs text-zinc-900">
                <input
                  type="text"
                  value={draft.toName ?? ''}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, toName: e.target.value }))
                  }
                  placeholder="Ville / aéroport / gare d'arrivée"
                  className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#C83228]"
                />
                {draft.toLat !== undefined && draft.toLng !== undefined && (
                  <span className="shrink-0 text-[10px] text-zinc-400">
                    {draft.toLat.toFixed(2)}, {draft.toLng.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-medium text-zinc-500">
                Référence / N° vol ou train
              </label>
              <input
                type="text"
                value={draft.bookingRef ?? ''}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, bookingRef: e.target.value }))
                }
                placeholder="ex: JL503, Nozomi 24"
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#C83228]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-zinc-500">
                Prix
              </label>
              <input
                type="text"
                value={draft.price ?? ''}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, price: e.target.value }))
                }
                placeholder="ex: 14 170 ¥"
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#C83228]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDraft((p) => ({ ...p, booked: !p.booked }))}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition ${
              draft.booked
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-zinc-200 bg-white text-zinc-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {draft.booked ? 'Réservation confirmée' : 'Pas encore réservé'}
            </span>
            <span className="text-[11px] underline">Changer</span>
          </button>

          <div>
            <label className="text-[11px] font-medium text-zinc-500">
              Notes
            </label>
            <textarea
              rows={3}
              value={draft.note}
              onChange={(e) =>
                setDraft((p) => ({ ...p, note: e.target.value }))
              }
              placeholder="Heure de départ, bagages, terminal..."
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#C83228]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-zinc-200 bg-zinc-50 px-5 py-3">
          <button
            type="submit"
            className="w-full rounded-lg bg-[#C83228] py-2 text-sm font-medium text-white transition hover:bg-[#B02A21]"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
