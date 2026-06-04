import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const FORMAT_COLORS: Record<string, string> = {
  standard: "bg-blue-900/50 text-blue-300 border-blue-800",
  alchemy: "bg-purple-900/50 text-purple-300 border-purple-800",
  historic: "bg-indigo-900/50 text-indigo-300 border-indigo-800",
  timeless: "bg-violet-900/50 text-violet-300 border-violet-800",
  brawl: "bg-pink-900/50 text-pink-300 border-pink-800",
  pioneer: "bg-green-900/50 text-green-300 border-green-800",
  modern: "bg-emerald-900/50 text-emerald-300 border-emerald-800",
  legacy: "bg-amber-900/50 text-amber-300 border-amber-800",
  vintage: "bg-orange-900/50 text-orange-300 border-orange-800",
  commander: "bg-red-900/50 text-red-300 border-red-800",
  pauper: "bg-gray-700/50 text-gray-300 border-gray-600",
};

export default async function DecksPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: decks } = await supabase
    .from("decks")
    .select("id, name, format, description, updated_at, deck_cards(count)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-100">My Decks</h1>
        <Link
          href="/decks/new"
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold rounded-lg transition-colors text-sm"
        >
          + New Deck
        </Link>
      </div>

      {!decks || decks.length === 0 ? (
        <div className="text-center py-24 text-gray-500">
          <p className="text-lg mb-2">No decks yet</p>
          <p className="text-sm mb-6">Create your first deck to get started</p>
          <Link
            href="/decks/new"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold rounded-lg transition-colors text-sm"
          >
            Create a deck
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck) => {
            const cardCount =
              (deck.deck_cards as { count: number }[])?.[0]?.count ?? 0;
            const formatColor =
              FORMAT_COLORS[deck.format] ??
              "bg-gray-700/50 text-gray-300 border-gray-600";
            const updated = new Date(deck.updated_at).toLocaleDateString(
              undefined,
              { month: "short", day: "numeric", year: "numeric" },
            );
            return (
              <Link
                key={deck.id}
                href={`/decks/${deck.id}`}
                className="group block bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 hover:bg-gray-800/60 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h2 className="font-semibold text-gray-100 group-hover:text-white leading-tight">
                    {deck.name}
                  </h2>
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded-full border capitalize ${formatColor}`}
                  >
                    {deck.format}
                  </span>
                </div>
                {deck.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                    {deck.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>{cardCount} cards</span>
                  <span>{updated}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
