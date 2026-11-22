'use client';

import { Calendar, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatFrenchDate } from '@/lib/japan-bounds';
import type { TripStep } from '@/lib/schemas';

interface TimelineBarProps {
  days: string[];
  activeIndex: number;
  onChangeIndex: (index: number) => void;
  steps?: TripStep[];
}

export function TimelineBar({
  days,
  activeIndex,
  onChangeIndex,
  steps = [],
}: TimelineBarProps) {
  const [playing, setPlaying] = useState(false);

  const safeIdx = Math.min(Math.max(0, activeIndex), Math.max(0, days.length - 1));
  const currentDay = days[safeIdx] ?? '';

  useEffect(() => {
    if (!playing || days.length <= 1) return;
    const interval = setInterval(() => {
      onChangeIndex(safeIdx + 1 >= days.length ? 0 : safeIdx + 1);
    }, 950);
    return () => clearInterval(interval);
  }, [playing, safeIdx, days.length, onChangeIndex]);

  if (days.length === 0) return null;

  const stepDates = new Set(steps.map((s) => s.date));

  return (
    <div className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-1.5 rounded-xl border border-zinc-200 bg-white/95 px-3.5 py-2.5 shadow-md backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-medium text-zinc-900">
          <Calendar className="h-3.5 w-3.5 text-[#C83228]" />
          <span>
            Jour {safeIdx + 1} / {days.length}
          </span>
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium capitalize text-zinc-600">
            {formatFrenchDate(currentDay, true)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              onChangeIndex(Math.max(0, safeIdx - 1));
            }}
            disabled={safeIdx === 0}
            className="rounded-md p-1 text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-35"
            title="Jour précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            disabled={days.length <= 1}
            className="flex items-center gap-1 rounded-md bg-[#C83228]/10 px-2 py-1 text-[11px] font-medium text-[#C83228] transition hover:bg-[#C83228]/15 disabled:opacity-40"
            title={playing ? 'Pause' : 'Animer la timeline'}
          >
            {playing ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">{playing ? 'Pause' : 'Lire'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              onChangeIndex(Math.min(days.length - 1, safeIdx + 1));
            }}
            disabled={safeIdx >= days.length - 1}
            className="rounded-md p-1 text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-35"
            title="Jour suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative flex items-center">
        <input
          type="range"
          min={0}
          max={Math.max(0, days.length - 1)}
          value={safeIdx}
          onChange={(e) => {
            setPlaying(false);
            onChangeIndex(Number(e.target.value));
          }}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-[#C83228]"
          aria-label="Curseur temporel du voyage"
        />
      </div>

      {days.length > 1 && (
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>{formatFrenchDate(days[0])}</span>
          <div className="flex items-center gap-1">
            {days.map((d, i) =>
              stepDates.has(d) ? (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    onChangeIndex(i);
                  }}
                  title={`Étape le ${formatFrenchDate(d)}`}
                  className={`h-1.5 w-1.5 rounded-full transition ${
                    i === safeIdx ? 'scale-125 bg-[#C83228]' : 'bg-zinc-400'
                  }`}
                />
              ) : null
            )}
          </div>
          <span>{formatFrenchDate(days[days.length - 1])}</span>
        </div>
      )}
    </div>
  );
}
