"use client";

import Link from "next/link";

export default function DeckError({ reset }: { reset: () => void }) {
  return (
    <div className="text-center py-24">
      <p className="text-lg text-gray-300 mb-2">Failed to load deck</p>
      <p className="text-sm text-gray-500 mb-6">
        The deck may have been deleted or you may not have access.
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={reset}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
        >
          Try again
        </button>
        <Link
          href="/decks"
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold rounded-lg text-sm transition-colors"
        >
          Back to decks
        </Link>
      </div>
    </div>
  );
}
