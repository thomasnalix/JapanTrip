'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Coins,
  ExternalLink,
  History,
  ImagePlus,
  Link2,
  MapPin,
  Move,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CATEGORY_ICONS } from '@/lib/icons';
import { compressImageFile } from '@/lib/image-utils';
import { formatDateTimeFr } from '@/lib/japan-bounds';
import {
  Activity,
  ActivityLink,
  Author,
  CATEGORIES,
  CATEGORY_META,
  Category,
  MAX_ACTIVITY_LINKS,
  MAX_ACTIVITY_PHOTOS,
  SearchPlaceResult,
} from '@/lib/schemas';
import { SearchPlaceBar } from './SearchPlaceBar';

interface ActivityDrawerProps {
  activity: Activity;
  isNew: boolean;
  activeAuthor: Author;
  isRepositioning: boolean;
  onToggleReposition: () => void;
  onFocusLocation: (lat: number, lng: number) => void;
  onSave: (updated: Activity, closeAfter?: boolean) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function ActivityDrawer({
  activity,
  isNew,
  activeAuthor,
  isRepositioning,
  onToggleReposition,
  onFocusLocation,
  onSave,
  onDelete,
  onClose,
}: ActivityDrawerProps) {
  const [draft, setDraft] = useState<Activity>(activity);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [showPhotoInput, setShowPhotoInput] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  function autoResize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    setDraft(activity);
    setPhotoIdx(0);
    setShowPhotoInput(false);
    setShowLocationSearch(false);
    setLinkError('');
    requestAnimationFrame(() => {
      autoResize(descRef.current);
      autoResize(noteRef.current);
    });
  }, [activity]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  function updateField(
    patch: Partial<Activity>,
    summary: string,
    immediate = false
  ) {
    const now = new Date().toISOString();
    setDraft((prev) => {
      const next: Activity = {
        ...prev,
        ...patch,
        updatedBy: activeAuthor,
        updatedAt: now,
      };
      if (!isNew) {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        const commit = () => {
          const withHistory: Activity = {
            ...next,
            history: [
              ...prev.history.slice(-14),
              { author: activeAuthor, action: 'updated', at: now, summary },
            ],
          };
          onSave(withHistory, false);
          setSavedToast(true);
          setTimeout(() => setSavedToast(false), 1400);
        };
        if (immediate) {
          commit();
        } else {
          autoSaveTimerRef.current = setTimeout(commit, 550);
        }
      }
      return next;
    });
  }

  function handleAddLink() {
    setLinkError('');
    if (draft.links.length >= MAX_ACTIVITY_LINKS) {
      setLinkError(`Maximum ${MAX_ACTIVITY_LINKS} liens atteint.`);
      return;
    }
    let rawUrl = linkUrl.trim();
    if (!rawUrl) return;
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = `https://${rawUrl}`;
    }
    try {
      const parsed = new URL(rawUrl);
      const label =
        linkLabel.trim() ||
        parsed.hostname.replace(/^www\./, '') ||
        'Lien';
      const nextLink: ActivityLink = {
        id: crypto.randomUUID(),
        label: label.slice(0, 80),
        url: parsed.toString(),
      };
      updateField(
        { links: [...draft.links, nextLink] },
        'Lien ajouté',
        true
      );
      setLinkLabel('');
      setLinkUrl('');
    } catch {
      setLinkError('URL invalide (ex: https://tabelog.com/...)');
    }
  }

  function handleDeleteLink(linkId: string) {
    updateField(
      { links: draft.links.filter((l) => l.id !== linkId) },
      'Lien supprimé',
      true
    );
  }

  function handleAddPhotoUrl() {
    const url = photoUrlInput.trim();
    if (!url || draft.photos.length >= MAX_ACTIVITY_PHOTOS) return;
    const nextPhotos = [...draft.photos, url];
    updateField({ photos: nextPhotos }, 'Photo ajoutée', true);
    setPhotoIdx(nextPhotos.length - 1);
    setPhotoUrlInput('');
    setShowPhotoInput(false);
  }

  async function handleFileUpload(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    setUploadingPhoto(true);
    try {
      const remaining = MAX_ACTIVITY_PHOTOS - draft.photos.length;
      const toProcess = Array.from(files).slice(0, remaining);
      if (toProcess.length === 0) return;
      const compressed = await Promise.all(
        toProcess.map((f) => compressImageFile(f))
      );
      const nextPhotos = [...draft.photos, ...compressed];
      updateField({ photos: nextPhotos }, 'Photo ajoutée', true);
      setPhotoIdx(nextPhotos.length - 1);
      setShowPhotoInput(false);
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    if (draft.photos.length >= MAX_ACTIVITY_PHOTOS) return;
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageFiles = items
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);

    if (imageFiles.length > 0) {
      e.preventDefault();
      void handleFileUpload(imageFiles);
    }
  }

  function handleRemoveCurrentPhoto() {
    if (draft.photos.length === 0) return;
    const nextPhotos = draft.photos.filter((_, i) => i !== photoIdx);
    updateField({ photos: nextPhotos }, 'Photo supprimée', true);
    setPhotoIdx(Math.max(0, Math.min(photoIdx, nextPhotos.length - 1)));
  }

  const catMeta = CATEGORY_META[draft.category];
  const safePhotoIdx = Math.min(
    photoIdx,
    Math.max(0, draft.photos.length - 1)
  );

  return (
    <aside
      onPaste={handlePaste}
      className="pointer-events-auto fixed bottom-0 right-0 top-auto z-40 flex max-h-[82vh] w-full flex-col overflow-hidden rounded-t-xl border border-zinc-200 bg-white shadow-xl md:bottom-4 md:right-4 md:top-24 md:max-h-none md:w-[400px] md:rounded-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md text-xs"
            style={{ backgroundColor: catMeta.softBg, color: catMeta.color }}
          >
            <FontAwesomeIcon icon={CATEGORY_ICONS[draft.category]} />
          </span>
          <span className="text-xs font-semibold text-zinc-600">
            {isNew ? 'Nouvelle activité' : catMeta.label}
          </span>
          {savedToast && (
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              Enregistré
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isNew && (
            <button
              type="button"
              onClick={() => onDelete(draft.id)}
              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-[#C83228]"
              title="Supprimer cette activité"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
            title="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="thin-scroll flex-1 space-y-4 overflow-y-auto p-4">
        {/* Photo Carousel */}
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
          {draft.photos.length > 0 ? (
            <div className="relative h-44 w-full bg-zinc-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={draft.photos[safePhotoIdx]}
                alt={draft.name}
                className="h-full w-full object-cover"
              />
              {draft.photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoIdx(
                        (safePhotoIdx - 1 + draft.photos.length) %
                          draft.photos.length
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-xs transition hover:bg-black/70"
                    aria-label="Photo précédente"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoIdx((safePhotoIdx + 1) % draft.photos.length)
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-xs transition hover:bg-black/70"
                    aria-label="Photo suivante"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/45 px-2 py-1 backdrop-blur-xs">
                {draft.photos.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPhotoIdx(idx)}
                    className={`h-1.5 rounded-full transition ${
                      idx === safePhotoIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                    }`}
                    aria-label={`Photo ${idx + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleRemoveCurrentPhoto}
                className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white transition hover:bg-[#C83228]"
                title="Retirer cette photo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex h-20 flex-col items-center justify-center gap-1 text-xs text-zinc-400">
              <ImagePlus className="h-4 w-4" />
              <span>Ctrl+V pour coller une image, ou importer</span>
            </div>
          )}

          {/* Add photo bar */}
          <div className="border-t border-zinc-200 bg-white px-3 py-2">
            {!showPhotoInput ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-zinc-500">
                  {draft.photos.length}/{MAX_ACTIVITY_PHOTOS} • Ctrl+V pour coller
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={
                      uploadingPhoto ||
                      draft.photos.length >= MAX_ACTIVITY_PHOTOS
                    }
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40"
                  >
                    <Upload className="h-3 w-3" />
                    {uploadingPhoto ? 'Compression...' : 'Importer'}
                  </button>
                  <button
                    type="button"
                    disabled={draft.photos.length >= MAX_ACTIVITY_PHOTOS}
                    onClick={() => setShowPhotoInput(true)}
                    className="flex items-center gap-1 rounded-md bg-[#C83228]/10 px-2 py-1 text-[11px] font-medium text-[#C83228] transition hover:bg-[#C83228]/15 disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" />
                    URL
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="url"
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPhotoUrl()}
                  placeholder="https://... (lien direct vers une image)"
                  className="flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs outline-none focus:border-[#C83228]"
                />
                <button
                  type="button"
                  onClick={handleAddPhotoUrl}
                  className="rounded-md bg-[#C83228] px-2.5 py-1 text-xs font-medium text-white"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setShowPhotoInput(false)}
                  className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFileUpload(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* Name & Description */}
        <div className="space-y-2">
          <input
            type="text"
            value={draft.name}
            onChange={(e) =>
              updateField({ name: e.target.value }, 'Titre modifié')
            }
            placeholder="Nom de l'activité"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none focus:border-[#C83228]"
          />
          <textarea
            ref={descRef}
            rows={4}
            value={draft.description}
            onChange={(e) => {
              autoResize(e.currentTarget);
              updateField(
                { description: e.target.value },
                'Description modifiée'
              );
            }}
            placeholder="Adresse ou description détaillée..."
            className="min-h-[96px] w-full resize-none overflow-hidden rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-700 outline-none focus:border-[#C83228]"
          />
        </div>

        {/* Location & Relocate */}
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-600">
              <MapPin className="h-3.5 w-3.5 text-[#C83228]" />
              {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleReposition}
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                  isRepositioning
                    ? 'border-[#C83228] bg-[#C83228] text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100'
                }`}
                title="Cliquer sur la carte pour déplacer ce point (ou glisser le marqueur)"
              >
                <Move className="h-3 w-3" />
                <span>{isRepositioning ? 'Cliquer sur la carte...' : 'Déplacer'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLocationSearch((s) => !s)}
                className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100"
              >
                <Search className="h-3 w-3" />
                <span>Chercher</span>
              </button>
            </div>
          </div>

          {showLocationSearch && (
            <SearchPlaceBar
              compact
              placeholder="Rechercher la nouvelle adresse..."
              onSelectPlace={(place: SearchPlaceResult) => {
                updateField(
                  {
                    lat: place.lat,
                    lng: place.lng,
                    address: place.address,
                  },
                  'Localisation modifiée',
                  true
                );
                onFocusLocation(place.lat, place.lng);
                setShowLocationSearch(false);
              }}
            />
          )}
        </div>

        {/* Category selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-zinc-500">
            Catégorie
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const selected = draft.category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    updateField(
                      { category: cat.id as Category },
                      `Catégorie: ${cat.label}`,
                      true
                    )
                  }
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition ${
                    selected
                      ? 'border-transparent text-white shadow-xs'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                  style={selected ? { backgroundColor: cat.color } : undefined}
                >
                  <FontAwesomeIcon
                    icon={CATEGORY_ICONS[cat.id]}
                    className="text-[11px]"
                  />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Simple Rating 0 to 5 (no slider) */}
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-800">
            <Star className="h-3.5 w-3.5 text-[#C83228]" />
            Note
          </span>
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4, 5].map((val) => {
              const active = Math.round(draft.rating) === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() =>
                    updateField({ rating: val }, `Note: ${val}/5`, true)
                  }
                  className={`h-7 w-7 rounded-md border text-xs font-semibold transition ${
                    active
                      ? 'border-transparent text-white shadow-xs'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100'
                  }`}
                  style={active ? { backgroundColor: catMeta.color } : undefined}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Note */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-zinc-500">
            Notes personnelles
          </label>
          <textarea
            ref={noteRef}
            rows={4}
            value={draft.note}
            onChange={(e) => {
              autoResize(e.currentTarget);
              updateField({ note: e.target.value }, 'Note modifiée');
            }}
            placeholder="Horaires, conseils, plat à goûter..."
            className="min-h-[96px] w-full resize-none overflow-hidden rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-900 outline-none focus:border-[#C83228]"
          />
        </div>

        {/* Optional metadata: Price & Ideal period */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] font-medium text-zinc-500">
              <Coins className="h-3 w-3" />
              Prix (optionnel)
            </label>
            <input
              type="text"
              value={draft.price ?? ''}
              onChange={(e) =>
                updateField({ price: e.target.value }, 'Prix modifié')
              }
              placeholder="ex: ~2 000 ¥"
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#C83228]"
            />
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] font-medium text-zinc-500">
              <CalendarClock className="h-3 w-3" />
              Période idéale
            </label>
            <input
              type="text"
              value={draft.idealPeriod ?? ''}
              onChange={(e) =>
                updateField(
                  { idealPeriod: e.target.value },
                  'Période idéale modifiée'
                )
              }
              placeholder="ex: Mi-nov, Matin"
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#C83228]"
            />
          </div>
        </div>

        {/* Optional ideal date range */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-zinc-500">
              Date idéale début (opt.)
            </label>
            <input
              type="date"
              value={draft.idealStartDate ?? ''}
              onChange={(e) =>
                updateField(
                  { idealStartDate: e.target.value || undefined },
                  'Date idéale modifiée',
                  true
                )
              }
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs outline-none focus:border-[#C83228]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-zinc-500">
              Date idéale fin (opt.)
            </label>
            <input
              type="date"
              value={draft.idealEndDate ?? ''}
              onChange={(e) =>
                updateField(
                  { idealEndDate: e.target.value || undefined },
                  'Date idéale modifiée',
                  true
                )
              }
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs outline-none focus:border-[#C83228]"
            />
          </div>
        </div>

        {/* Links (max 10) */}
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-800">
              <Link2 className="h-3.5 w-3.5 text-zinc-500" />
              Liens ({draft.links.length}/{MAX_ACTIVITY_LINKS})
            </span>
          </div>

          {draft.links.length > 0 && (
            <div className="space-y-1.5">
              {draft.links.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs"
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-1.5 font-medium text-[#C83228] hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDeleteLink(link.id)}
                    className="rounded-md p-1 text-zinc-400 transition hover:bg-red-50 hover:text-[#C83228]"
                    title="Supprimer ce lien"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {draft.links.length < MAX_ACTIVITY_LINKS && (
            <div className="space-y-1.5 pt-1">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder="Titre"
                  className="w-1/3 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs outline-none focus:border-[#C83228]"
                />
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                  placeholder="https://..."
                  className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs outline-none focus:border-[#C83228]"
                />
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-zinc-800"
                >
                  +
                </button>
              </div>
              {linkError && (
                <p className="text-[11px] text-[#C83228]">{linkError}</p>
              )}
            </div>
          )}
        </div>

        {/* Author & Edit History */}
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[11px] text-zinc-500">
          <div className="flex items-center justify-between">
            <div>
              <div>
                Créé par{' '}
                <strong className="text-zinc-800">{draft.createdBy}</strong> le{' '}
                {formatDateTimeFr(draft.createdAt)}
              </div>
              <div>
                Modifié par{' '}
                <strong className="text-zinc-800">{draft.updatedBy}</strong> le{' '}
                {formatDateTimeFr(draft.updatedAt)}
              </div>
            </div>
            {draft.history.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory((s) => !s)}
                className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-700 hover:bg-zinc-100"
              >
                <History className="h-3 w-3" />
                {draft.history.length}
              </button>
            )}
          </div>

          {showHistory && draft.history.length > 0 && (
            <div className="mt-2 max-h-28 space-y-1 overflow-y-auto border-t border-zinc-200 pt-2">
              {[...draft.history].reverse().map((h, i) => (
                <div key={i} className="flex justify-between text-[10px]">
                  <span>
                    <strong className="text-zinc-700">{h.author}</strong> —{' '}
                    {h.summary ||
                      (h.action === 'created' ? 'Création' : 'Modification')}
                  </span>
                  <span>{formatDateTimeFr(h.at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer CTA for new activity */}
      {isNew && (
        <div className="border-t border-zinc-200 bg-zinc-50 p-3">
          <button
            type="button"
            disabled={!draft.name.trim()}
            onClick={() =>
              onSave(
                {
                  ...draft,
                  name: draft.name.trim(),
                  history: [
                    {
                      author: activeAuthor,
                      action: 'created',
                      at: new Date().toISOString(),
                      summary: 'Création',
                    },
                  ],
                },
                false
              )
            }
            className="w-full rounded-lg bg-[#C83228] py-2 text-sm font-medium text-white shadow-xs transition hover:bg-[#B02A21] disabled:opacity-45"
          >
            Enregistrer
          </button>
        </div>
      )}
    </aside>
  );
}
