import Link from "next/link";

const NAV_LINKS = [
  { href: "/cards", label: "Cards" },
  { href: "/decks", label: "Decks" },
  { href: "/collection", label: "Collection" },
  { href: "/art", label: "Card Art" },
  { href: "/ai-builder", label: "AI Builder" },
];

export function NavBar() {
  return (
    <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 flex items-center gap-6 h-14">
        <Link href="/" className="font-bold text-lg text-amber-400 shrink-0">
          MTGA Deck Builder
        </Link>
        <div className="flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-md text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
