const SYMBOL_SIZES: Record<string, string> = {};

function symbolToFilename(sym: string): string {
  // {W/U} → WU, {2/W} → 2W, {W/P} → WP (phyrexian)
  return sym.replace(/\//g, "");
}

function ManaSymbol({ symbol, size }: { symbol: string; size: number }) {
  const filename = symbolToFilename(symbol);
  const px = `${size}px`;
  return (
    <img
      src={`https://svgs.scryfall.io/card-symbols/${filename}.svg`}
      alt={`{${symbol}}`}
      width={size}
      height={size}
      style={{
        width: px,
        height: px,
        display: "inline-block",
        verticalAlign: "middle",
      }}
      aria-label={symbol}
    />
  );
}

export function ManaCost({
  cost,
  size = 22,
  className = "",
}: {
  cost: string | null;
  size?: number;
  className?: string;
}) {
  if (!cost) return null;

  // Parse "{1}{U}{U}" → ["1", "U", "U"]
  const symbols = [...cost.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);

  if (symbols.length === 0) return null;

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      aria-label={cost}
    >
      {symbols.map((sym, i) => (
        <ManaSymbol key={i} symbol={sym} size={size} />
      ))}
    </span>
  );
}
