"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function CardsPage() {
  const [filters, setFilters] = useState<CardFilters>(DEFAULT_FILTERS);
  const [cards, setCards] = useState<CardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.query) params.set("q", filters.query);
      if (filters.format) params.set("format", filters.format);
      if (filters.arenaOnly) params.set("arena", "1");
      if (filters.colors.length) params.set("colors", filters.colors.join(","));
      if (filters.cmcValues.length)
        params.set("cmc", filters.cmcValues.join(","));
      if (filters.rarities.length)
        params.set("rarities", filters.rarities.join(","));
      if (filters.types.length) params.set("types", filters.types.join(","));
      if (filters.setCodes.length)
        params.set("sets", filters.setCodes.join(","));

      const res = await fetch(`/api/cards/search?${params}`);
      if (!res.ok) throw new Error(await res.text());
      setCards(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    search();
  }, [search]);

  function handleFiltersChange(patch: Partial<CardFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

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

      <CardGrid cards={cards} loading={loading} />
    </div>
  );
}
