"use client";

import { useState, useEffect, useCallback } from "react";
import { CardGrid } from "@/components/cards/CardGrid";
import { CardSearchFilters } from "@/components/cards/CardSearchFilters";
import type { Format } from "@mtga/core";

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
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState<Format | "">("");
  const [arenaOnly, setArenaOnly] = useState(true);
  const [cards, setCards] = useState<CardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (format) params.set("format", format);
      if (arenaOnly) params.set("arena", "1");
      const res = await fetch(`/api/cards/search?${params}`);
      if (!res.ok) throw new Error(await res.text());
      setCards(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [query, format, arenaOnly]);

  useEffect(() => {
    search();
  }, [search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Card Browser</h1>
        <p className="text-gray-400 text-sm">Search the full card database</p>
      </div>

      <CardSearchFilters
        query={query}
        format={format}
        arenaOnly={arenaOnly}
        onQueryChange={setQuery}
        onFormatChange={setFormat}
        onArenaOnlyChange={setArenaOnly}
      />

      {error && (
        <p className="text-red-400 text-sm" role="alert">
          {error}
        </p>
      )}

      <CardGrid cards={cards} loading={loading} />
    </div>
  );
}
