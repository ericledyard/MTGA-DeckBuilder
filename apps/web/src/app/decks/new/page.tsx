"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FORMATS = [
  "standard",
  "alchemy",
  "historic",
  "timeless",
  "brawl",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "commander",
  "pauper",
] as const;

export default function NewDeckPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<string>("standard");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, format, description: description || null }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create deck");
      setLoading(false);
      return;
    }

    const deck = await res.json();
    router.push(`/decks/${deck.id}`);
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-100 mb-6">New Deck</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="name"
              className="block text-sm text-gray-400 mb-1.5"
            >
              Deck name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
              placeholder="My Awesome Deck"
            />
          </div>

          <div>
            <label
              htmlFor="format"
              className="block text-sm text-gray-400 mb-1.5"
            >
              Format
            </label>
            <select
              id="format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm capitalize"
            >
              {FORMATS.map((f) => (
                <option key={f} value={f} className="capitalize">
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm text-gray-400 mb-1.5"
            >
              Description <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm resize-none"
              placeholder="Notes about the deck strategy…"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-2 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 py-2 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-950 font-semibold rounded-lg transition-colors text-sm"
            >
              {loading ? "Creating…" : "Create deck"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
