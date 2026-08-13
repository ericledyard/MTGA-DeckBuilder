"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CardGrid } from "@/components/cards/CardGrid";
import {
  CardSearchFilters,
  DEFAULT_FILTERS,
  type CardFilters,
} from "@/components/cards/CardSearchFilters";

export interface CardSearchResult {
  id: string;
  oracle_id: string;
  name: string;
  mana_cost: string | null;
  type_line: string;
  rarity: string;
  image_uri_normal: string | null;
  image_uri_art_crop: string | null;
  available_on_arena: boolean;
  is_alchemy: boolean;
  set_code: string;
  set_name: string;
}

function parseFilters(
  searchParams: ReturnType<typeof useSearchParams>,
): CardFilters {
  return {
    query: searchParams.get("q") ?? DEFAULT_FILTERS.query,
    textQuery: searchParams.get("text") ?? DEFAULT_FILTERS.textQuery,
    format: (searchParams.get("format") ??
      DEFAULT_FILTERS.format) as CardFilters["format"],
    // absent = default ON (see DEFAULT_FILTERS); "0" = explicitly cleared
    arenaOnly: searchParams.get("arena") !== "0",
    colors: searchParams.get("colors")?.split(",").filter(Boolean) ?? [],
    cmcValues:
      searchParams
        .get("cmc")
        ?.split(",")
        .map(Number)
        .filter((n) => !isNaN(n)) ?? [],
    rarities: searchParams.get("rarities")?.split(",").filter(Boolean) ?? [],
    types: searchParams.get("types")?.split(",").filter(Boolean) ?? [],
    setCodes: searchParams.get("sets")?.split(",").filter(Boolean) ?? [],
  };
}

function filtersToParams(filters: CardFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.textQuery) params.set("text", filters.textQuery);
  if (filters.format) params.set("format", filters.format);
  // Only the non-default needs to appear in the URL.
  if (!filters.arenaOnly) params.set("arena", "0");
  if (filters.colors.length) params.set("colors", filters.colors.join(","));
  if (filters.cmcValues.length) params.set("cmc", filters.cmcValues.join(","));
  if (filters.rarities.length)
    params.set("rarities", filters.rarities.join(","));
  if (filters.types.length) params.set("types", filters.types.join(","));
  if (filters.setCodes.length) params.set("sets", filters.setCodes.join(","));
  return params;
}

const PAGE_SIZE = 48;

function CardsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [cards, setCards] = useState<CardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = parseFilters(searchParams);
  const page = Math.max(0, Number(searchParams.get("page") ?? "0"));

  function handleFiltersChange(patch: Partial<CardFilters>) {
    const next = { ...filters, ...patch };
    const params = filtersToParams(next);
    // Reset to page 0 on any filter change
    router.replace(`/cards?${params}`, { scroll: false });
  }

  function goToPage(next: number) {
    const params = filtersToParams(filters);
    if (next > 0) params.set("page", String(next));
    router.replace(`/cards?${params}`, { scroll: false });
  }

  const search = useCallback(async () => {
    const apiParams = filtersToParams(filters);
    if (filters.arenaOnly) apiParams.set("arena", "1");
    apiParams.set("limit", String(PAGE_SIZE));
    apiParams.set("offset", String(page * PAGE_SIZE));
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/cards/search?${apiParams}`);
      if (!r.ok) {
        // Prefer the route's own message over statusText ("Service Unavailable"
        // tells the user nothing about what failed).
        const detail = await r
          .json()
          .then((b) => (typeof b?.error === "string" ? b.error : null))
          .catch(() => null);
        throw new Error(detail ?? "Card search failed. Please try again.");
      }
      const data = await r.json();
      setCards(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps -- searchParams drives filters + page

  useEffect(() => {
    search(); // eslint-disable-line react-hooks/set-state-in-effect -- async fetch pattern
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [search]);

  const hasPrev = page > 0;
  // If we got a full page, there's likely a next page
  const hasNext = cards.length === PAGE_SIZE;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Card Browser</h1>
        <p className="text-gray-400 text-sm">Search the full card database</p>
      </div>

      <CardSearchFilters filters={filters} onChange={handleFiltersChange} />

      {/* Arena chip — on by default, clearable. Shown here rather than only
          inside the collapsed Filters panel so it is never a hidden reason for
          a card being missing from results. */}
      {filters.arenaOnly && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleFiltersChange({ arenaOnly: false })}
            aria-label="Showing only cards available on Arena. Click to show all cards."
            title="Showing only cards on Arena. Click to include paper-only cards."
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border border-amber-500/60 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors"
          >
            Arena only
            <span aria-hidden="true" className="text-amber-400/80">
              ✕
            </span>
          </button>
          <span className="text-[11px] text-gray-500">
            Clear to include paper-only cards
          </span>
        </div>
      )}

      {/* A failed search is not an empty catalogue — show the error and a way
          to retry instead of the grid's "No cards found" empty state. */}
      {error ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 py-20 text-center"
        >
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => search()}
            className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-gray-900 rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <CardGrid
          cards={cards}
          loading={loading}
          backHref={(() => {
            const params = filtersToParams(filters);
            if (page > 0) params.set("page", String(page));
            return `/cards?${params}`;
          })()}
        />
      )}

      {!error && !loading && (cards.length > 0 || page > 0) && (
        <div className="flex items-center justify-between pt-2 pb-6">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={!hasPrev}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-500">
            {page === 0
              ? `Cards 1–${cards.length}`
              : `Cards ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + cards.length}`}
          </span>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={!hasNext}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export default function CardsPage() {
  return (
    <Suspense>
      <CardsPageContent />
    </Suspense>
  );
}
