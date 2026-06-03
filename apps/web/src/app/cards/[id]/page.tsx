import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@mtga/db";
import type { Database } from "@mtga/db";

type CardRow = Database["public"]["Tables"]["cards"]["Row"];
type LegalityRow = Database["public"]["Tables"]["card_legalities"]["Row"];
type LegalityStatus = Database["public"]["Enums"]["legality_status"];

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
  legal: "bg-green-900/60 text-green-300",
  not_legal: "bg-gray-800 text-gray-500",
  banned: "bg-red-900/60 text-red-300",
  restricted: "bg-yellow-900/60 text-yellow-300",
  suspended: "bg-orange-900/60 text-orange-300",
};

function ManaCost({ cost }: { cost: string | null }) {
  if (!cost) return null;
  return (
    <span className="font-mono text-amber-300 tracking-wide">
      {cost
        .replace(/[{}]/g, (m) => (m === "{" ? "" : m === "}" ? " " : m))
        .trim()}
    </span>
  );
}

function LegalityTable({ legalities }: { legalities: LegalityRow[] }) {
  const byFormat = Object.fromEntries(
    legalities.map((l) => [l.format, l.status]),
  );

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {Object.entries(FORMAT_LABELS).map(([fmt, label]) => {
        const status = (byFormat[fmt] as LegalityStatus) ?? "not_legal";
        return (
          <div
            key={fmt}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs ${STATUS_STYLES[status]}`}
          >
            <span className="font-medium">{label}</span>
            <span className="capitalize">{status.replace("_", " ")}</span>
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
    .select("*")
    .eq("id", id)
    .single();

  if (error || !card) notFound();

  const { data: legalities } = await supabase
    .from("card_legalities")
    .select("format, status")
    .eq("oracle_id", (card as CardRow).oracle_id);

  const c = card as CardRow;
  const image = c.image_uri_large ?? c.image_uri_normal;

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/cards"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
      >
        ← Back to card browser
      </Link>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Card image */}
        <div className="flex-shrink-0 w-full md:w-72">
          {image ? (
            <div className="relative aspect-[5/7] rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
              <Image
                src={image}
                alt={c.name}
                fill
                sizes="(max-width: 768px) 100vw, 288px"
                className="object-cover"
                priority
              />
            </div>
          ) : (
            <div className="aspect-[5/7] rounded-2xl bg-gray-800 flex items-center justify-center text-gray-600">
              No image
            </div>
          )}
        </div>

        {/* Card details */}
        <div className="flex-1 space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <h1 className="text-3xl font-bold text-white">{c.name}</h1>
              <ManaCost cost={c.mana_cost} />
            </div>
            <p className="text-gray-400 mt-1">{c.type_line}</p>
            <div className="flex gap-3 mt-2 text-xs text-gray-500">
              <span className="capitalize">{c.rarity}</span>
              <span>·</span>
              <span>{c.set_name}</span>
              <span>·</span>
              <span className="uppercase">{c.set_code}</span>
              {c.artist && (
                <>
                  <span>·</span>
                  <span>Illus. {c.artist}</span>
                </>
              )}
            </div>
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
            <p className="text-gray-500 text-sm italic px-1">{c.flavor_text}</p>
          )}

          {/* Stats row */}
          {(c.power || c.toughness || c.loyalty) && (
            <div className="flex gap-4 text-sm">
              {c.power && c.toughness && (
                <div className="bg-gray-800 rounded-lg px-4 py-2 text-center">
                  <p className="text-xs text-gray-500 mb-0.5">P/T</p>
                  <p className="text-white font-bold">
                    {c.power}/{c.toughness}
                  </p>
                </div>
              )}
              {c.loyalty && (
                <div className="bg-gray-800 rounded-lg px-4 py-2 text-center">
                  <p className="text-xs text-gray-500 mb-0.5">Loyalty</p>
                  <p className="text-white font-bold">{c.loyalty}</p>
                </div>
              )}
            </div>
          )}

          {/* Format legality */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Format Legality
            </h2>
            <LegalityTable legalities={(legalities ?? []) as LegalityRow[]} />
          </div>
        </div>
      </div>
    </div>
  );
}
