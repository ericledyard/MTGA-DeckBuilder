"use client";

interface ManaCurveChartProps {
  cards: { cmc: number; quantity: number; type_line: string }[];
}

export function ManaCurveChart({ cards }: ManaCurveChartProps) {
  const buckets = Array.from({ length: 8 }, (_, i) => ({
    label: i === 7 ? "7+" : String(i),
    creatures: 0,
    other: 0,
  }));

  for (const card of cards) {
    if (card.type_line.toLowerCase().includes("land")) continue;
    const idx = Math.min(Math.max(0, Math.floor(Number(card.cmc) || 0)), 7);
    const isCreature = card.type_line.toLowerCase().includes("creature");
    if (isCreature) buckets[idx].creatures += card.quantity;
    else buckets[idx].other += card.quantity;
  }

  const max = Math.max(...buckets.map((b) => b.creatures + b.other), 1);

  return (
    <div>
      <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1.5">
        Mana Curve
      </p>
      <div className="flex items-end gap-0.5 h-12">
        {buckets.map((bucket) => {
          const total = bucket.creatures + bucket.other;
          const creatureH = total > 0 ? (bucket.creatures / max) * 100 : 0;
          const otherH = total > 0 ? (bucket.other / max) * 100 : 0;
          return (
            <div
              key={bucket.label}
              className="flex-1 flex flex-col items-center gap-0"
              title={`${bucket.label} mana: ${total} cards`}
            >
              <div
                className="w-full flex flex-col justify-end"
                style={{ height: "40px" }}
              >
                {otherH > 0 && (
                  <div
                    className="w-full bg-indigo-500 rounded-t-sm"
                    style={{ height: `${otherH}%` }}
                  />
                )}
                {creatureH > 0 && (
                  <div
                    className="w-full bg-amber-500"
                    style={{
                      height: `${creatureH}%`,
                      borderRadius: otherH === 0 ? "2px 2px 0 0" : "0",
                    }}
                  />
                )}
                {total === 0 && (
                  <div
                    className="w-full bg-gray-800"
                    style={{ height: "2px" }}
                  />
                )}
              </div>
              <span className="text-[9px] text-gray-600 mt-0.5">
                {bucket.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-1">
        <span className="flex items-center gap-1 text-[10px] text-gray-600">
          <span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" />
          Creatures
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-600">
          <span className="w-2 h-2 rounded-sm bg-indigo-500 inline-block" />
          Other
        </span>
      </div>
    </div>
  );
}
