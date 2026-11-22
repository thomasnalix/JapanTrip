'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CATEGORY_ICONS } from '@/lib/icons';
import { CATEGORY_META, type SearchPlaceResult } from '@/lib/schemas';

interface SearchPlaceBarProps {
  placeholder?: string;
  onSelectPlace: (place: SearchPlaceResult) => void;
  compact?: boolean;
}

export function SearchPlaceBar({
  placeholder = 'Rechercher un lieu au Japon (ex: Fukiage Onsen, Kyoto...)',
  onSelectPlace,
  compact = false,
}: SearchPlaceBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchPlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const json = (await res.json()) as { results?: SearchPlaceResult[] };
          setResults(json.results ?? []);
          setOpen(true);
        }
      } catch {
        // Ignore abort / transient errors
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={`flex items-center gap-2 rounded-lg border border-zinc-200 bg-white/95 shadow-sm backdrop-blur-md transition focus-within:border-[#C83228] focus-within:ring-2 focus-within:ring-[#C83228]/15 ${
          compact ? 'px-3 py-1.5' : 'px-3 py-2'
        }`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#C83228]" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-zinc-400" />
        )}
        <input
          type="text"
          value={query}
          onFocus={() => results.length > 0 && setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setOpen(false);
            }}
            className="rounded-md p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Effacer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="thin-scroll absolute left-0 right-0 z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg">
          {results.map((place) => {
            const meta = CATEGORY_META[place.suggestedCategory];
            return (
              <button
                key={place.id}
                type="button"
                onClick={() => {
                  onSelectPlace(place);
                  setOpen(false);
                  setQuery('');
                }}
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-zinc-100"
              >
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs"
                  style={{ backgroundColor: meta.softBg, color: meta.color }}
                >
                  <FontAwesomeIcon icon={CATEGORY_ICONS[place.suggestedCategory]} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-900">
                    {place.name}
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {place.description || place.address}
                  </div>
                </div>
                <MapPin className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-400" />
              </button>
            );
          })}
        </div>
      )}

      {open && !loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-500 shadow-lg">
          Aucun lieu trouvé au Japon pour « {query.trim()} ». Essayez un nom
          plus court ou cliquez sur la carte.
        </div>
      )}
    </div>
  );
}
