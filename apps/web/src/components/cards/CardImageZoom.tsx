"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface Props {
  src: string;
  largeSrc: string;
  alt: string;
  width?: number;
}

export function CardImageZoom({ src, largeSrc, alt, width = 288 }: Props) {
  const [zoomed, setZoomed] = useState(false);

  // Close on backdrop click or Escape while zoomed.
  // The overlay uses pointer-events:none so mouse events pass through to the
  // thumbnail below — onMouseLeave on the thumbnail still fires when the
  // cursor moves off the card, dismissing the zoom naturally.
  useEffect(() => {
    if (!zoomed) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setZoomed(false);
    }
    function onDocClick() {
      setZoomed(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onDocClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onDocClick);
    };
  }, [zoomed]);

  return (
    <>
      {/* Thumbnail */}
      <div
        className="relative aspect-[5/7] rounded-2xl overflow-hidden shadow-2xl shadow-black/70 ring-1 ring-white/5 cursor-zoom-in"
        onMouseEnter={() => setZoomed(true)}
        onMouseLeave={() => setZoomed(false)}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={`(max-width: 768px) 100vw, ${width}px`}
          className="object-cover"
          priority
        />
      </div>

      {/* Zoom overlay — pointer-events:none so mouse stays "on" the thumbnail */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-none"
          style={{ animation: "zoomFadeIn 150ms ease-out" }}
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={largeSrc}
            alt={alt}
            className="h-[92vh] w-auto rounded-xl shadow-2xl shadow-black/90 select-none"
            style={{ maxWidth: "90vw" }}
            draggable={false}
          />
        </div>
      )}
    </>
  );
}
