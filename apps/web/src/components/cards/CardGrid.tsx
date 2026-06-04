import Link from "next/link";
import Image from "next/image";
import type { CardSearchResult } from "@/app/cards/page";

function RarityBadge({ rarity }: { rarity: string }) {
  const colors: Record<string, string> = {
    common: "text-gray-400",
    uncommon: "text-blue-400",
    rare: "text-amber-400",
    mythic: "text-orange-400",
  };
  return (
    <span
      className={`text-xs font-medium capitalize ${colors[rarity] ?? "text-gray-400"}`}
    >
      {rarity}
    </span>
  );
}

function CardTile({
  card,
  backHref,
}: {
  card: CardSearchResult;
  backHref?: string;
}) {
  const href = backHref
    ? `/cards/${card.id}?ref=${encodeURIComponent(backHref)}`
    : `/cards/${card.id}`;
  return (
    <Link
      href={href}
      className="group relative rounded-xl overflow-hidden border border-gray-800 hover:border-amber-500/60 transition-all bg-gray-900"
      aria-label={`View ${card.name}`}
    >
      <div className="aspect-[5/7] relative bg-gray-800">
        {card.image_uri_normal ? (
          <Image
            src={card.image_uri_normal}
            alt={card.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            No image
          </div>
        )}
        {card.is_alchemy && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-xs bg-purple-900/90 text-purple-300 font-medium">
            Alchemy
          </span>
        )}
      </div>
      <div className="p-3 space-y-1">
        <p className="text-sm font-medium text-white truncate">{card.name}</p>
        <p className="text-xs text-gray-500 truncate">{card.type_line}</p>
        <div className="flex items-center justify-between">
          <RarityBadge rarity={card.rarity} />
          <span className="text-xs text-gray-600 uppercase">
            {card.set_code}
          </span>
        </div>
      </div>
    </Link>
  );
}

function SkeletonTile() {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-800 bg-gray-900 animate-pulse">
      <div className="aspect-[5/7] bg-gray-800" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-700 rounded w-3/4" />
        <div className="h-3 bg-gray-700 rounded w-1/2" />
      </div>
    </div>
  );
}

interface Props {
  cards: CardSearchResult[];
  loading: boolean;
  backHref?: string;
}

export function CardGrid({ cards, loading, backHref }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 24 }).map((_, i) => (
          <SkeletonTile key={i} />
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-lg">No cards found</p>
        <p className="text-sm mt-1">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {cards.map((card) => (
        <CardTile key={card.id} card={card} backHref={backHref} />
      ))}
    </div>
  );
}
