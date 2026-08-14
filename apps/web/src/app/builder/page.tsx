import type { Metadata } from "next";
import { BuilderDeckList } from "@/components/builder/BuilderDeckList";

export const metadata: Metadata = {
  title: "Stateless Deck Builder",
  description:
    "Build and export MTGA decks without an account. Decks stay in your browser.",
};

// Deliberately not auth-gated, and deliberately not reading Supabase: every
// deck here lives in the visitor's browser. See lib/builder/storage.ts.
export default function BuilderPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-100">
          Stateless Deck Builder
        </h1>
        <p className="text-sm text-gray-400">
          No login required. Build a deck, then export the list when you are
          done.
        </p>
        <p className="text-sm rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-300">
          YOU CAN ONLY EXPORT THE DECKLIST but you will not be able to save it
          without logging in. Decks are kept in this browser only — clearing
          site data or switching devices loses them.
        </p>
      </header>

      <BuilderDeckList />
    </div>
  );
}
