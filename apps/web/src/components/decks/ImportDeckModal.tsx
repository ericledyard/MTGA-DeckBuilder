"use client";

import { useState } from "react";
import { parseDecklist } from "@/lib/parsers/decklist";

export interface ResolvedImportCard {
  oracle_id: string;
  name: string;
  quantity: number;
  isSideboard: boolean;
  isCommander: boolean;
  mana_cost: string | null;
  cmc: number;
  type_line: string;
  colors: string[];
  image_uri_normal: string | null;
  rarity: string;
  set_code: string | null;
  collector_number: string | null;
}

interface PreviewRow {
  name: string;
  quantity: number;
  isSideboard: boolean;
  isCommander: boolean;
  found: boolean;
  resolved?: ResolvedImportCard;
}

interface ImportDeckModalProps {
  deckId: string;
  currentCardCount: number;
  onImport: (cards: ResolvedImportCard[], replace: boolean) => Promise<void>;
  onClose: () => void;
}

type Step = "input" | "loading" | "preview" | "importing";

export function ImportDeckModal({
  currentCardCount,
  onImport,
  onClose,
}: ImportDeckModalProps) {
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [replace, setReplace] = useState(true);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    if (!text.trim()) return;
    setError(null);
    setStep("loading");

    const parsed = parseDecklist(text);
    const allParsed = [
      ...parsed.commander.map((c) => ({
        ...c,
        isSideboard: false,
        isCommander: true,
      })),
      ...parsed.main.map((c) => ({
        ...c,
        isSideboard: false,
        isCommander: false,
      })),
      ...parsed.sideboard.map((c) => ({
        ...c,
        isSideboard: true,
        isCommander: false,
      })),
    ];

    if (allParsed.length === 0) {
      setError("No card lines found. Check the format and try again.");
      setStep("input");
      return;
    }

    const items = allParsed.map((c) => ({
      name: c.name,
      setCode: c.setCode ?? null,
      collectorNumber: c.collectorNumber ?? null,
    }));

    let lookupData: (ResolvedImportCard & {
      set_code?: string | null;
      collector_number?: string | null;
    })[] = [];
    try {
      const res = await fetch("/api/cards/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("lookup failed");
      lookupData = await res.json();
    } catch {
      setError("Failed to look up cards. Please try again.");
      setStep("input");
      return;
    }

    const setCollectorKey = (s: string, n: string) =>
      `${s.toLowerCase()}:${n.toLowerCase()}`;
    const bySetCollector = new Map(
      lookupData
        .filter((c) => c.set_code && c.collector_number)
        .map((c) => [setCollectorKey(c.set_code!, c.collector_number!), c]),
    );
    const byName = new Map(lookupData.map((c) => [c.name.toLowerCase(), c]));

    const rows: PreviewRow[] = allParsed.map((c) => {
      const matched =
        c.setCode && c.collectorNumber
          ? (bySetCollector.get(
              setCollectorKey(c.setCode, c.collectorNumber),
            ) ?? byName.get(c.name.toLowerCase()))
          : byName.get(c.name.toLowerCase());
      if (!matched)
        return {
          name: c.name,
          quantity: c.quantity,
          isSideboard: c.isSideboard,
          isCommander: c.isCommander,
          found: false,
        };
      return {
        name: c.name,
        quantity: c.quantity,
        isSideboard: c.isSideboard,
        isCommander: c.isCommander,
        found: true,
        resolved: {
          oracle_id: matched.oracle_id,
          name: matched.name,
          quantity: c.quantity,
          isSideboard: c.isSideboard,
          isCommander: c.isCommander,
          mana_cost: matched.mana_cost,
          cmc: matched.cmc,
          type_line: matched.type_line,
          colors: matched.colors,
          image_uri_normal: matched.image_uri_normal,
          rarity: matched.rarity,
          set_code: matched.set_code ?? null,
          collector_number: matched.collector_number ?? null,
        },
      };
    });

    setPreview(rows);
    setStep("preview");
  }

  async function handleImport() {
    const cards = preview
      .filter((r) => r.found && r.resolved)
      .map((r) => r.resolved!);
    if (cards.length === 0) return;
    setStep("importing");
    await onImport(cards, replace);
  }

  const foundCount = preview.filter((r) => r.found).length;
  const notFoundCount = preview.filter((r) => !r.found).length;
  const totalQty = preview
    .filter((r) => r.found)
    .reduce((s, r) => s + r.quantity, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800 shrink-0">
          <h2 className="text-sm font-bold text-gray-100 tracking-wide uppercase">
            Import Deck List
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {(step === "input" || step === "loading") && (
            <div className="space-y-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Paste your deck list here…\n\nExamples:\n  Deck\n  4 Lightning Bolt (M21) 160\n  1 Island\n\n  Sideboard\n  2 Negate`}
                rows={14}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-xs text-gray-200 placeholder-gray-600 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-transparent"
                disabled={step === "loading"}
              />

              <p className="text-[11px] text-gray-500">
                Supports: <span className="text-gray-400">MTGA</span>,{" "}
                <span className="text-gray-400">MTGO</span> (SB: prefix),{" "}
                <span className="text-gray-400">Moxfield</span> (// headers),{" "}
                <span className="text-gray-400">plain text</span>
              </p>

              {currentCardCount > 0 && (
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={replace}
                    onChange={(e) => setReplace(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-amber-500"
                  />
                  <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">
                    Replace existing {currentCardCount} card
                    {currentCardCount !== 1 ? "s" : ""}
                  </span>
                </label>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
                  {error}
                </p>
              )}
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex items-center gap-3 text-xs">
                <span className="text-green-400 font-medium">
                  ✓ {foundCount} found
                </span>
                {notFoundCount > 0 && (
                  <span className="text-red-400 font-medium">
                    ✗ {notFoundCount} not found
                  </span>
                )}
                <span className="ml-auto text-gray-500">
                  {totalQty} total cards
                </span>
              </div>

              {/* Card list */}
              <div className="space-y-0.5 max-h-72 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 px-1 py-1">
                {preview.map((row, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                      row.found ? "text-gray-300" : "text-red-400 bg-red-950/20"
                    }`}
                  >
                    <span
                      className={`shrink-0 text-[10px] font-bold w-3 ${row.found ? "text-green-500" : "text-red-500"}`}
                    >
                      {row.found ? "✓" : "✗"}
                    </span>
                    <span className="shrink-0 w-5 text-right text-gray-500 font-mono">
                      {row.quantity}
                    </span>
                    <span className="flex-1 truncate">{row.name}</span>
                    {row.isCommander && (
                      <span className="shrink-0 text-[9px] text-amber-500 uppercase tracking-widest font-bold">
                        CMD
                      </span>
                    )}
                    {row.isSideboard && (
                      <span className="shrink-0 text-[9px] text-gray-600 uppercase tracking-widest">
                        side
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {notFoundCount > 0 && (
                <p className="text-[11px] text-yellow-600">
                  Not-found cards will be skipped. They may be misspelled or not
                  yet in the database.
                </p>
              )}

              {currentCardCount > 0 && (
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={replace}
                    onChange={(e) => setReplace(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-amber-500"
                  />
                  <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">
                    Replace existing {currentCardCount} card
                    {currentCardCount !== 1 ? "s" : ""}
                  </span>
                </label>
              )}
            </div>
          )}

          {step === "importing" && (
            <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
              Importing…
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-5 py-3.5 border-t border-gray-800">
          {step === "preview" ? (
            <>
              <button
                onClick={() => setStep("input")}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleImport}
                disabled={foundCount === 0}
                className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-gray-900 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Import {totalQty} card{totalQty !== 1 ? "s" : ""}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={!text.trim() || step === "loading"}
                className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-gray-900 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {step === "loading" ? "Parsing…" : "Parse & Preview"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
