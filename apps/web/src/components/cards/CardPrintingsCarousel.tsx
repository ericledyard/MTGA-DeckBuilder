"use client";

import { useCallback, useEffect, useState } from "react";

export interface PrintingInfo {
  id: string;
  setCode: string;
  setName: string;
  setIconUri: string | null;
  imageNormal: string;
  imageLarge: string | null;
  rarity: string;
  collectorNumber: string;
}

const RARITY_DOT: Record<string, string> = {
  common: "bg-gray-400",
  uncommon: "bg-blue-300",
  rare: "bg-yellow-400",
  mythic: "bg-orange-500",
};

// Cards visible in the fan stack behind the active card
const STACK_DEPTH = 3;

interface Props {
  printings: PrintingInfo[];
  initialIndex?: number;
}

export function CardPrintingsCarousel({ printings, initialIndex = 0 }: Props) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  // Captures the printing at click time — isolated from hover index changes
  const [zoomedPrinting, setZoomedPrinting] = useState<PrintingInfo | null>(null);

  const active = printings[activeIndex];
  if (!active) return null;

  // ── Mouse navigation: X position across container maps to printing index ──
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const idx = Math.max(
        0,
        Math.min(Math.floor(relX * printings.length), printings.length - 1),
      );
      setActiveIndex(idx);
    },
    [printings.length],
  );

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(initialIndex);
  }, [initialIndex]);

  // ── Zoom: click active card to open, click backdrop / Escape to close ──
  useEffect(() => {
    if (!zoomedPrinting) return;
    function onDocClick() {
      setZoomedPrinting(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setZoomedPrinting(null);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [zoomedPrinting]);

  return (
    <>
      <div className="space-y-3">
        {/* ── Card fan stack ────────────────────────────────────────────── */}
        <div
          className="relative aspect-[5/7] cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {printings.map((p, i) => {
            const d = i - activeIndex;
            const absd = Math.abs(d);
            const inStack = absd <= STACK_DEPTH;
            const isActive = d === 0;

            // Fan: cards offset and rotated away from center, stacking behind
            const tx = isActive
              ? 0
              : Math.sign(d) * Math.min(absd, STACK_DEPTH) * 6;
            const ty = isActive ? 0 : Math.min(absd, STACK_DEPTH) * 3;
            const rot = isActive
              ? 0
              : Math.sign(d) * Math.min(absd, STACK_DEPTH) * 2.5;
            const sc = isActive ? 1 : 1 - Math.min(absd, STACK_DEPTH) * 0.025;
            const opacity = isActive
              ? 1
              : absd === 1
                ? 0.55
                : absd === 2
                  ? 0.28
                  : absd === 3
                    ? 0.12
                    : 0;

            return (
              <div
                key={p.id}
                className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10"
                style={{
                  transform: `translateX(${tx}px) translateY(${ty}px) rotate(${rot}deg) scale(${sc})`,
                  opacity: inStack ? opacity : 0,
                  zIndex: inStack ? 50 - absd * 10 : 0,
                  transition: "transform 0.2s ease, opacity 0.2s ease",
                  transformOrigin: "bottom center",
                  visibility: inStack ? "visible" : "hidden",
                  pointerEvents: isActive ? "auto" : "none",
                }}
                onClick={isActive ? () => setZoomedPrinting(printings[activeIndex]) : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageNormal}
                  alt={isActive ? `${p.setName} #${p.collectorNumber}` : ""}
                  className="w-full h-full object-cover select-none"
                  draggable={false}
                />
                {/* Zoom hint on active card */}
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 bg-black/20">
                    <span className="text-white/80 text-xs bg-black/50 px-2 py-1 rounded-md pointer-events-none">
                      Click to zoom
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Printing count */}
          <div className="absolute top-2 right-2 z-50 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full pointer-events-none select-none">
            {activeIndex + 1}&thinsp;/&thinsp;{printings.length}
          </div>
        </div>

        {/* ── Active printing info ──────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 text-sm">
            {active.setIconUri && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.setIconUri}
                alt=""
                width={16}
                height={16}
                className="w-4 h-4 flex-shrink-0 opacity-70"
              />
            )}
            <span className="text-gray-200 font-medium truncate">
              {active.setName}
            </span>
            <span className="text-gray-600 text-xs uppercase flex-shrink-0">
              {active.collectorNumber}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${RARITY_DOT[active.rarity] ?? "bg-gray-400"}`}
            />
            <span className="text-gray-500 text-xs capitalize">
              {active.rarity}
            </span>
          </div>
        </div>

        {/* ── Navigation indicator ──────────────────────────────────────── */}
        {printings.length > 1 && printings.length <= 16 && (
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {printings.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={`Printing ${i + 1}`}
                className={`rounded-full transition-all duration-150 ${
                  i === activeIndex
                    ? "w-4 h-1.5 bg-amber-400"
                    : "w-1.5 h-1.5 bg-gray-700 hover:bg-gray-500"
                }`}
              />
            ))}
          </div>
        )}
        {printings.length > 16 && (
          <div className="flex items-center gap-2 px-1">
            <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-150"
                style={{
                  width: `${((activeIndex + 1) / printings.length) * 100}%`,
                }}
              />
            </div>
            <span className="text-xs text-gray-600 tabular-nums flex-shrink-0">
              {activeIndex + 1}/{printings.length}
            </span>
          </div>
        )}
        {printings.length > 1 && (
          <p className="text-xs text-gray-600 text-center">
            Slide cursor left/right to browse printings · click to zoom
          </p>
        )}
      </div>

      {/* ── Full-screen zoom overlay ──────────────────────────────────── */}
      {zoomedPrinting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          style={{ animation: "zoomFadeIn 150ms ease-out" }}
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomedPrinting.imageLarge ?? zoomedPrinting.imageNormal}
            alt={`${zoomedPrinting.setName} #${zoomedPrinting.collectorNumber}`}
            className="h-[92vh] w-auto rounded-xl shadow-2xl shadow-black/90 select-none"
            style={{ maxWidth: "90vw" }}
            draggable={false}
          />
        </div>
      )}
    </>
  );
}
