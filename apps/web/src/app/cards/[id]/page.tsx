import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@mtga/db";
import type { Database } from "@mtga/db";
import { ManaCost } from "@/components/ui/ManaCost";
import { CardImageZoom } from "@/components/cards/CardImageZoom";

type CardRow = Database["public"]["Tables"]["cards"]["Row"];
type LegalityRow = Database["public"]["Tables"]["card_legalities"]["Row"];
type LegalityStatus = Database["public"]["Enums"]["legality_status"];

const FORMAT_ORDER = [
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

const FORMAT_LABELS: Record<string, string> = {
  standard: "Standard",
  alchemy: "Alchemy",
  historic: "Historic",
  timeless: "Timeless",
  brawl: "Brawl",
  pioneer: "Pioneer",
  modern: "Modern",
  legacy: "Legacy",
  vintage: "Vintage",
  commander: "Commander",
  pauper: "Pauper",
};

const STATUS_STYLES: Record<LegalityStatus, string> = {
  legal: "bg-green-900/50 border border-green-700/50 text-green-300",
  not_legal: "bg-gray-800/60 border border-gray-700/30 text-gray-500",
  banned: "bg-red-900/50 border border-red-700/50 text-red-300",
  restricted: "bg-yellow-900/50 border border-yellow-700/50 text-yellow-300",
  suspended: "bg-orange-900/50 border border-orange-700/50 text-orange-300",
};

const RARITY_STYLES: Record<string, React.CSSProperties> = {
  common: { color: "#d1d5db" },
  uncommon: {
    background: "linear-gradient(135deg, #9ca3af, #d1d5db, #9ca3af)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  rare: {
    background: "linear-gradient(135deg, #b8860b, #ffd700, #daa520)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  mythic: {
    background: "linear-gradient(135deg, #c2410c, #f97316, #fb923c, #f59e0b)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
};

import type React from "react";

function RarityLabel({ rarity }: { rarity: string }) {
  const style = RARITY_STYLES[rarity] ?? RARITY_STYLES.common;
  return (
    <span className="text-sm font-bold capitalize" style={style}>
      {rarity}
    </span>
  );
}

function ArenaBadge({
  available,
  isAlchemy,
}: {
  available: boolean;
  isAlchemy: boolean;
}) {
  if (isAlchemy) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-900/70 border border-purple-500/50 text-purple-200">
        <span className="text-purple-400 font-black italic text-sm leading-none">
          A
        </span>
        Alchemy
      </span>
    );
  }
  if (available) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-900/70 border border-teal-500/50 text-teal-200">
        <svg
          viewBox="0 0 16 16"
          className="w-3 h-3 fill-teal-400"
          aria-hidden="true"
        >
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zm2.5-5.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
        MTGA
      </span>
    );
  }
  return null;
}

function SetSymbol({
  iconUri,
  setName,
}: {
  iconUri: string | null;
  setName: string;
}) {
  if (!iconUri) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iconUri}
      alt={`${setName} set symbol`}
      className="w-5 h-5 object-contain opacity-80 inline-block"
    />
  );
}

function LegalityTable({ legalities }: { legalities: LegalityRow[] }) {
  const byFormat = Object.fromEntries(
    legalities.map((l) => [l.format, l.status]),
  );

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {FORMAT_ORDER.map((fmt) => {
        const status = (byFormat[fmt] as LegalityStatus) ?? "not_legal";
        return (
          <div
            key={fmt}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium ${STATUS_STYLES[status]}`}
          >
            <span>{FORMAT_LABELS[fmt]}</span>
            <span className="capitalize opacity-90">
              {status.replace("_", " ")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: card, error } = await supabase
    .from("cards")
    .select("*, sets(icon_svg_uri)")
    .eq("id", id)
    .single();

  if (error || !card) notFound();

  const { data: legalities } = await supabase
    .from("card_legalities")
    .select("format, status")
    .eq("oracle_id", card.oracle_id);

  const c = card as CardRow & { sets: { icon_svg_uri: string | null } | null };
  const thumbSrc = c.image_uri_normal ?? c.image_uri_large;
  const largeSrc = c.image_uri_large ?? c.image_uri_normal;
  const setIconUri = c.sets?.icon_svg_uri ?? null;

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/cards"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-6 transition-colors"
      >
        ← Back to card browser
      </Link>

      <div className="flex flex-col md:flex-row gap-10">
        {/* Card image — hover to zoom */}
        <div className="flex-shrink-0 w-full md:w-64 lg:w-72">
          {thumbSrc && largeSrc ? (
            <CardImageZoom src={thumbSrc} largeSrc={largeSrc} alt={c.name} />
          ) : (
            <div className="aspect-[5/7] rounded-2xl bg-gray-800 flex items-center justify-center text-gray-600 ring-1 ring-white/5">
              No image
            </div>
          )}
        </div>

        {/* Card details */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Name + mana cost */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h1 className="text-3xl font-bold text-white leading-tight">
              {c.name}
            </h1>
            <span className="bg-gray-800/80 px-3 py-1.5 rounded-lg border border-gray-700 flex-shrink-0">
              <ManaCost cost={c.mana_cost} size={24} />
            </span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <ArenaBadge
              available={c.available_on_arena}
              isAlchemy={c.is_alchemy}
            />
          </div>

          {/* Type line */}
          <p className="text-gray-300 text-base">{c.type_line}</p>

          {/* Set / rarity / artist row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <SetSymbol iconUri={setIconUri} setName={c.set_name} />
              <span className="text-white font-semibold text-sm">
                {c.set_name}
              </span>
              <span className="text-gray-600 text-xs uppercase">
                {c.set_code}
              </span>
            </div>
            <span className="text-gray-700">·</span>
            <RarityLabel rarity={c.rarity} />
            {c.artist && (
              <>
                <span className="text-gray-700">·</span>
                <span className="text-gray-400 text-sm">
                  Illus.{" "}
                  <span className="text-gray-300 font-medium">{c.artist}</span>
                </span>
              </>
            )}
          </div>

          {/* Oracle text */}
          {c.oracle_text && (
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-line">
                {c.oracle_text}
              </p>
            </div>
          )}

          {/* Flavor text */}
          {c.flavor_text && (
            <p className="text-gray-500 text-sm italic border-l-2 border-gray-700 pl-3">
              {c.flavor_text}
            </p>
          )}

          {/* Stats */}
          {(c.power || c.toughness || c.loyalty) && (
            <div className="flex gap-3">
              {c.power && c.toughness && (
                <div className="bg-gray-800 rounded-xl px-5 py-2.5 text-center border border-gray-700">
                  <p className="text-xs text-gray-500 mb-0.5 uppercase tracking-wider">
                    P / T
                  </p>
                  <p className="text-white font-bold text-lg">
                    {c.power}/{c.toughness}
                  </p>
                </div>
              )}
              {c.loyalty && (
                <div className="bg-gray-800 rounded-xl px-5 py-2.5 text-center border border-gray-700">
                  <p className="text-xs text-gray-500 mb-0.5 uppercase tracking-wider">
                    Loyalty
                  </p>
                  <p className="text-white font-bold text-lg">{c.loyalty}</p>
                </div>
              )}
            </div>
          )}

          {/* Format legality */}
          <div>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
              Format Legality
            </h2>
            <LegalityTable legalities={(legalities ?? []) as LegalityRow[]} />
          </div>
        </div>
      </div>
    </div>
  );
}
