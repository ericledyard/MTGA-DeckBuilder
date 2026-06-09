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
    // absent = default false; "1" = explicitly on
    arenaOnly: searchParams.get("arena") === "1",
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
  if (filters.arenaOnly) params.set("arena", "1");
  if (filters.colors.length) params.set("colors", filters.colors.join(","));
  if (filters.cmcValues.length) params.set("cmc", filters.cmcValues.join(","));
  if (filters.rarities.length)
    params.set("rarities", filters.rarities.join(","));
  if (filters.types.length) params.set("types", filters.types.join(","));
  if (filters.setCodes.length) params.set("sets", filters.setCodes.join(","));
  return params;
}

function CardsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [cards, setCards] = useState<CardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = parseFilters(searchParams);

  function handleFiltersChange(patch: Partial<CardFilters>) {
    const next = { ...filters, ...patch };
    const params = filtersToParams(next);
    router.replace(`/cards?${params}`, { scroll: false });
  }

  const search = useCallback(async () => {
    const apiParams = filtersToParams(filters);
    if (filters.arenaOnly) apiParams.set("arena", "1");
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/cards/search?${apiParams}`);
      if (!r.ok) throw new Error(r.statusText);
      setCards(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps -- searchParams drives filters

  useEffect(() => {
    search(); // eslint-disable-line react-hooks/set-state-in-effect -- async fetch pattern
  }, [search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Card Browser</h1>
        <p className="text-gray-400 text-sm">Search the full card database</p>
      </div>

      <CardSearchFilters filters={filters} onChange={handleFiltersChange} />

      {error && (
        <p className="text-red-400 text-sm" role="alert">
          {error}
        </p>
      )}

      <CardGrid
        cards={cards}
        loading={loading}
        backHref={`/cards?${filtersToParams(filters)}`}
      />
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
