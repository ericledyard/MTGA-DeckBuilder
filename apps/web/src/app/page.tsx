import Link from "next/link";

const FEATURES = [
  {
    href: "/cards",
    icon: "🃏",
    title: "Card Browser",
    desc: "Search 95k+ cards with MTGA availability and format legality",
  },
  {
    href: "/decks",
    icon: "📋",
    title: "Deck Builder",
    desc: "Build, validate, and export decks in any MTGA format",
  },
  {
    href: "/collection",
    icon: "📦",
    title: "My Collection",
    desc: "Import your untapped.gg collection and track owned cards",
  },
  {
    href: "/art",
    icon: "🖼️",
    title: "Card Art Browser",
    desc: "Full-screen HD card art viewer by artist, set, or color",
  },
  {
    href: "/ai-builder",
    icon: "✨",
    title: "AI Deck Builder",
    desc: "Google Gemini-powered agentic deck building from your collection",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="text-center space-y-4 py-12">
        <h1 className="text-4xl font-bold text-amber-400">MTGA Deck Builder</h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Build, manage, and AI-power your Magic: The Gathering Arena decks.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/cards"
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold rounded-lg transition-colors"
          >
            Browse Cards
          </Link>
          <Link
            href="/decks/new"
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
          >
            New Deck
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="p-6 rounded-xl border border-gray-800 bg-gray-900 hover:border-amber-500/50 hover:bg-gray-800/80 transition-all group"
          >
            <div className="text-3xl mb-3">{f.icon}</div>
            <h2 className="font-semibold text-white group-hover:text-amber-400 transition-colors mb-1">
              {f.title}
            </h2>
            <p className="text-sm text-gray-400">{f.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
