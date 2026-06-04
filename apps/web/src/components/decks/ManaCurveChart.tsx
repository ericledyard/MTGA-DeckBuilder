"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ManaCurveChartProps {
  cards: { cmc: number; quantity: number; type_line: string }[];
}

export function ManaCurveChart({ cards }: ManaCurveChartProps) {
  const buckets = Array.from({ length: 8 }, (_, i) => ({
    cmc: i === 7 ? "7+" : String(i),
    creatures: 0,
    other: 0,
  }));

  for (const card of cards) {
    const idx = Math.min(Math.floor(card.cmc), 7);
    const isCreature = card.type_line.toLowerCase().includes("creature");
    if (isCreature) buckets[idx].creatures += card.quantity;
    else buckets[idx].other += card.quantity;
  }

  const max = Math.max(...buckets.map((b) => b.creatures + b.other), 1);

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
        Mana Curve
      </p>
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={buckets} barSize={14} barGap={2}>
          <XAxis
            dataKey="cmc"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis domain={[0, max]} hide />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
            contentStyle={{
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: "#d1d5db" }}
            itemStyle={{ color: "#9ca3af" }}
          />
          <Bar
            dataKey="creatures"
            stackId="a"
            name="Creatures"
            fill="#f59e0b"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="other"
            stackId="a"
            name="Other"
            fill="#6366f1"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-3 mt-1">
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" />
          Creatures
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-sm bg-indigo-500 inline-block" />
          Other
        </span>
      </div>
    </div>
  );
}
