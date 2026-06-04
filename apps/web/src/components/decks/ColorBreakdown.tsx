"use client";

const COLOR_SYMBOLS: Record<string, string> = {
  W: "W",
  U: "U",
  B: "B",
  R: "R",
  G: "G",
};

interface ColorBreakdownProps {
  cards: { colors: string[]; quantity: number }[];
}

export function ColorBreakdown({ cards }: ColorBreakdownProps) {
  const counts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

  for (const card of cards) {
    if (card.colors.length === 0) {
      counts.C += card.quantity;
    } else {
      for (const color of card.colors) {
        if (color in counts) counts[color] += card.quantity;
      }
    }
  }

  const active = Object.entries(counts).filter(([, n]) => n > 0);
  if (active.length === 0) return null;

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
        Colors
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {active.map(([color, count]) => (
          <div key={color} className="flex items-center gap-1">
            <img
              src={`https://svgs.scryfall.io/card-symbols/${COLOR_SYMBOLS[color] ?? color}.svg`}
              alt={color}
              className="w-5 h-5"
            />
            <span className="text-xs text-gray-400">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
